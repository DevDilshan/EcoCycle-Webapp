import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../app/eco_app_scope.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_loading.dart';

/// Reward catalog and the resident's own redemption requests.
///
/// Pick an item to request it; a Pending request can be switched to another
/// item or cancelled. Points only leave the balance once an admin approves.
class RedeemScreen extends StatefulWidget {
  const RedeemScreen({super.key, required this.balance});

  final int balance;

  @override
  State<RedeemScreen> createState() => _RedeemScreenState();
}

class _RedeemScreenState extends State<RedeemScreen> {
  late final Api _api;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  List<Map<String, dynamic>> _catalog = [];
  List<Map<String, dynamic>> _requests = [];

  int get _reserved => _requests
      .where((r) => r['status'] == 'Pending')
      .fold<int>(0, (sum, r) => sum + _int(r['points']));

  int get _available => widget.balance - _reserved;

  static int _int(Object? value) => (value as num?)?.toInt() ?? 0;

  @override
  void initState() {
    super.initState();
    _api = EcoAppScope.apiOf(context);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.get('/reward-items', query: {'pageSize': '100'}),
        _api.get('/redemptions', query: {'pageSize': '50'}),
      ]);
      _catalog =
          (results[0]?['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      _requests =
          (results[1]?['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    } catch (e) {
      _error = _clean(e);
    }
    if (mounted) setState(() => _loading = false);
  }

  String _clean(Object e) => e.toString().replaceFirst('Exception: ', '');

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  /// Runs an API call, reports the outcome and refreshes the lists.
  Future<void> _run(Future<void> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      _toast(success);
      await _load();
    } catch (e) {
      _toast(_clean(e));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _request(Map<String, dynamic> item) async {
    final confirmed = await _confirm(
      title: 'Request ${item['name']}?',
      body:
          '${item['pointsCost']} points will be set aside until an admin decides. '
          'You can change or cancel it until then.',
      yes: 'Send request',
    );
    if (confirmed != true) return;
    await _run(
      () => _api.post('/redemptions', body: {'rewardItemId': item['id']}),
      'Request sent. An admin will review it.',
    );
  }

  Future<void> _change(Map<String, dynamic> request) async {
    final room = _available + _int(request['points']);
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: EcoColors.canvas,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 22),
          children: [
            const Text(
              'Switch to',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            const SizedBox(height: 10),
            for (final item in _catalog)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  item['name'] as String,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text('${item['pointsCost']} points'),
                enabled: _int(item['pointsCost']) <= room && item['stock'] != 0,
                selected: item['id'] == request['rewardItemId'],
                onTap: () => Navigator.pop(ctx, item['id'] as String),
              ),
          ],
        ),
      ),
    );
    if (picked == null || picked == request['rewardItemId']) return;
    await _run(
      () => _api.put(
        '/redemptions/${request['id']}',
        body: {'rewardItemId': picked},
      ),
      'Request updated.',
    );
  }

  Future<void> _cancel(Map<String, dynamic> request) async {
    final confirmed = await _confirm(
      title: 'Cancel request?',
      body: 'Your request for ${request['reason']} will be removed.',
      yes: 'Cancel request',
      no: 'Keep it',
    );
    if (confirmed != true) return;
    await _run(
      () => _api.delete('/redemptions/${request['id']}'),
      'Request cancelled.',
    );
  }

  Future<bool?> _confirm({
    required String title,
    required String body,
    required String yes,
    String no = 'Not now',
  }) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(no),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(yes),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EcoBackHeader(title: 'Redeem points'),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                children: [
                  _BalanceCard(
                    balance: widget.balance,
                    reserved: _reserved,
                    available: _available,
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Rewards',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const SizedBox(height: 10),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.all(32),
                      child: EcoLoadingState(
                        title: 'Loading your EcoCycle',
                        message: 'Bringing your latest details together.',
                        compact: true,
                      ),
                    )
                  else if (_error != null)
                    _Notice(text: _error!, onRetry: _load)
                  else ...[
                    if (_catalog.isEmpty)
                      const _Notice(
                        text: 'No rewards are available yet. Check back soon.',
                      )
                    else
                      for (final item in _catalog)
                        _CatalogCard(
                          item: item,
                          available: _available,
                          busy: _busy,
                          onRequest: () => _request(item),
                        ),
                    const SizedBox(height: 18),
                    const Text(
                      'My requests',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 10),
                    if (_requests.isEmpty)
                      const _Notice(text: 'No redemption requests yet.')
                    else
                      for (final request in _requests)
                        _RequestCard(
                          request: request,
                          busy: _busy,
                          onChange: () => _change(request),
                          onCancel: () => _cancel(request),
                        ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.balance,
    required this.reserved,
    required this.available,
  });

  final int balance;
  final int reserved;
  final int available;

  @override
  Widget build(BuildContext context) {
    Widget row(String label, String value, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 13, color: EcoColors.body),
          ),
          Text(
            value,
            style: TextStyle(
              fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
              fontSize: strong ? 18 : 14,
              color: strong ? EcoColors.primary : EcoColors.ink,
            ),
          ),
        ],
      ),
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          row('Balance', '$balance pts'),
          row('Waiting for approval', '- $reserved pts'),
          const Divider(height: 14),
          row('Available to request', '$available pts', strong: true),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, this.onRetry});

  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: EcoColors.mintBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              height: 1.5,
              color: EcoColors.label,
            ),
          ),
          if (onRetry != null)
            TextButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}

class _CatalogCard extends StatelessWidget {
  const _CatalogCard({
    required this.item,
    required this.available,
    required this.busy,
    required this.onRequest,
  });

  final Map<String, dynamic> item;
  final int available;
  final bool busy;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    final cost = (item['pointsCost'] as num?)?.toInt() ?? 0;
    final stock = (item['stock'] as num?)?.toInt();
    final soldOut = stock != null && stock <= 0;
    final locked = soldOut || cost > available;
    final description = item['description'] as String?;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: EcoColors.mintBg,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.card_giftcard, color: EcoColors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['name'] as String? ?? '',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                Text(
                  '$cost points${stock == null
                      ? ''
                      : soldOut
                      ? ' · sold out'
                      : ' · $stock left'}',
                  style: const TextStyle(fontSize: 12, color: EcoColors.body),
                ),
                if (description != null && description.isNotEmpty)
                  Text(
                    description,
                    style: const TextStyle(
                      fontSize: 12,
                      color: EcoColors.muted,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Material(
            color: locked ? const Color(0xFFEEF3EE) : EcoColors.primary,
            borderRadius: BorderRadius.circular(10),
            child: InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: locked || busy ? null : onRequest,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 8,
                ),
                child: Text(
                  soldOut
                      ? 'Sold out'
                      : locked
                      ? 'Locked'
                      : 'Request',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: locked ? EcoColors.muted : Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.onChange,
    required this.onCancel,
  });

  final Map<String, dynamic> request;
  final bool busy;
  final VoidCallback onChange;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final status = request['status'] as String? ?? 'Pending';
    final pending = status == 'Pending';
    final note = request['adminNote'] as String?;
    final created = DateTime.tryParse(
      request['createdAt'] as String? ?? '',
    )?.toLocal();
    final (Color fg, Color bg) = switch (status) {
      'Approved' => (EcoColors.primary, EcoColors.mintBg),
      'Rejected' => (EcoColors.danger, EcoColors.dangerBg),
      _ => (EcoColors.amber, const Color(0xFFFFF4DC)),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  request['reason'] as String? ?? '',
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${request['points']} points${created == null ? '' : ' · ${DateFormat('d MMM').format(created)}'}',
            style: const TextStyle(fontSize: 12, color: EcoColors.body),
          ),
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Admin: $note',
              style: const TextStyle(fontSize: 12, color: EcoColors.label),
            ),
          ],
          if (pending) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                TextButton(
                  onPressed: busy ? null : onChange,
                  child: const Text('Change'),
                ),
                TextButton(
                  onPressed: busy ? null : onCancel,
                  style: TextButton.styleFrom(
                    foregroundColor: EcoColors.danger,
                  ),
                  child: const Text('Cancel request'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
