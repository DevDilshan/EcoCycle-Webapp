import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../app/eco_app_scope.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_loading.dart';
import '../widgets/reward_artwork.dart';
import '../widgets/reward_catalog_card.dart';

/// Reward catalog and the resident's own redemption requests.
///
/// Pick an item to request it; a Pending request can be switched to another
/// item or cancelled. Points only leave the balance once an admin approves;
/// the request then shows a code and how the reward reaches the resident
/// (collected in person, emailed, or posted to an address they give).
class RedeemScreen extends StatefulWidget {
  const RedeemScreen({
    super.key,
    required this.balance,
    this.requestsOnly = false,
  });

  final int balance;
  final bool requestsOnly;

  @override
  State<RedeemScreen> createState() => _RedeemScreenState();
}

class _RedeemScreenState extends State<RedeemScreen> {
  late final Api _api;
  late int _balance;
  String _search = '';
  bool _withinPoints = false;
  String _requestFilter = 'All';
  bool _loading = true;
  bool _busy = false;
  String? _error;
  List<Map<String, dynamic>> _catalog = [];
  List<Map<String, dynamic>> _requests = [];

  int get _reserved => _requests
      .where((r) => r['status'] == 'Pending')
      .fold<int>(0, (sum, r) => sum + _int(r['points']));

  int get _available =>
      (_balance - _reserved).clamp(0, _balance < 0 ? 0 : _balance);

  static int _int(Object? value) => (value as num?)?.toInt() ?? 0;

  @override
  void initState() {
    super.initState();
    _balance = widget.balance;
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
        _api.get('/redemptions', query: {'pageSize': '100'}),
        _api.get(
          '/rewards/${EcoAppScope.userOf(context)!.id}/history',
          query: {'pageSize': '1'},
        ),
      ]);
      if (!mounted) return;
      _balance = (results[2]?['currentBalance'] as num?)?.toInt() ?? _balance;
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
          'You can change or cancel it until then.\n\n'
          'How you get it: ${_deliveryWords(item['delivery']).option}.',
      yes: 'Send request',
    );
    if (confirmed != true) return;
    String? address;
    if (item['delivery'] == 'Post') {
      address = await _askAddress('');
      if (address == null) return;
    }
    await _run(
      () => _api.post(
        '/redemptions',
        body: {'rewardItemId': item['id'], 'deliveryAddress': address},
      ),
      'Request sent. An admin will review it.',
    );
  }

  /// A posted reward needs somewhere to go. Returns null if the resident backs out.
  Future<String?> _askAddress(String initial) {
    final controller = TextEditingController(text: initial);
    String? error;
    return showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Where should we post it?'),
          content: TextField(
            controller: controller,
            autofocus: true,
            minLines: 2,
            maxLines: 4,
            maxLength: 300,
            textCapitalization: TextCapitalization.words,
            decoration: InputDecoration(
              labelText: 'Postal address',
              errorText: error,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                final value = controller.text.trim();
                if (value.length < 10) {
                  setLocal(() => error = 'Enter the full address.');
                  return;
                }
                Navigator.pop(ctx, value);
              },
              child: const Text('Use this address'),
            ),
          ],
        ),
      ),
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
                leading: RewardArtwork(
                  imageUrl: item['imageUrl'] as String?,
                  itemName: item['name'] as String?,
                  size: 48,
                ),
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
    String? address;
    final posted = _catalog.any(
      (item) => item['id'] == picked && item['delivery'] == 'Post',
    );
    if (posted) {
      address = await _askAddress(request['deliveryAddress'] as String? ?? '');
      if (address == null) return;
    }
    await _run(
      () => _api.put(
        '/redemptions/${request['id']}',
        body: {'rewardItemId': picked, 'deliveryAddress': address},
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

  Future<void> _openDetails(Map<String, dynamic> item) async {
    final request = await showRewardDetails(
      context,
      item: item,
      available: _available,
      busy: _busy,
    );
    if (request == true && mounted && !_busy) await _request(item);
  }

  Future<void> _openRequests() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => RewardRequestsScreen(balance: _balance),
      ),
    );
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = _catalog.where((item) {
      final matches = '${item['name']} ${item['description'] ?? ''}'
          .toLowerCase()
          .contains(_search.toLowerCase());
      return matches &&
          (!_withinPoints ||
              (_int(item['pointsCost']) <= _available && item['stock'] != 0));
    }).toList();
    final requests = _requests
        .where((r) => _requestFilter == 'All' || r['status'] == _requestFilter)
        .toList();
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(
            title: widget.requestsOnly
                ? 'My reward requests'
                : 'Explore rewards',
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                children: [
                  _BalanceCard(
                    balance: _balance,
                    reserved: _reserved,
                    available: _available,
                  ),
                  const SizedBox(height: 18),
                  if (_loading)
                    const EcoLoadingState(
                      title: 'Loading your rewards',
                      message: 'Finding your next greener reward.',
                      compact: true,
                    )
                  else if (_error != null)
                    _Notice(text: _error!, onRetry: _load)
                  else if (widget.requestsOnly) ...[
                    const Text(
                      'Track approvals, delivery and collection codes.',
                      style: TextStyle(
                        color: EcoColors.body,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 14),
                    FilterPills(
                      labels: const ['All', 'Pending', 'Approved', 'Rejected'],
                      selected: [
                        'All',
                        'Pending',
                        'Approved',
                        'Rejected',
                      ].indexOf(_requestFilter),
                      onSelect: (i) => setState(
                        () => _requestFilter = [
                          'All',
                          'Pending',
                          'Approved',
                          'Rejected',
                        ][i],
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (requests.isEmpty)
                      const _Notice(text: 'No requests in this view yet.')
                    else
                      for (final request in requests)
                        _RequestCard(
                          request: request,
                          imageUrl: _catalog
                              .where((i) => i['id'] == request['rewardItemId'])
                              .map((i) => i['imageUrl'] as String?)
                              .firstOrNull,
                          busy: _busy,
                          onChange: () => _change(request),
                          onCancel: () => _cancel(request),
                        ),
                  ] else ...[
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Small swaps. Lasting impact.',
                            style: TextStyle(
                              fontSize: 14,
                              color: EcoColors.body,
                              height: 1.5,
                            ),
                          ),
                        ),
                        TextButton(
                          onPressed: _busy ? null : _openRequests,
                          child: const Text('My requests'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      onChanged: (value) => setState(() => _search = value),
                      decoration: InputDecoration(
                        hintText: 'Search rewards',
                        prefixIcon: const Icon(Icons.search_rounded),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(
                            color: EcoColors.cardBorder,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilterPills(
                      labels: const ['All rewards', 'Within my points'],
                      selected: _withinPoints ? 1 : 0,
                      onSelect: (i) => setState(() => _withinPoints = i == 1),
                    ),
                    const SizedBox(height: 18),
                    if (catalog.isEmpty)
                      _Notice(
                        text: _catalog.isEmpty
                            ? 'No rewards are available yet. Check back soon.'
                            : 'No rewards match this view. Try another search or filter.',
                      )
                    else
                      RewardCatalogGrid(
                        items: catalog,
                        available: _available,
                        onTap: _openDetails,
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

/// Browsing and request tracking are separate destinations, sharing the same
/// reservation and delivery workflow.
class RewardCatalogScreen extends StatelessWidget {
  const RewardCatalogScreen({super.key, required this.balance});
  final int balance;
  @override
  Widget build(BuildContext context) => RedeemScreen(balance: balance);
}

class RewardRequestsScreen extends StatelessWidget {
  const RewardRequestsScreen({super.key, required this.balance});
  final int balance;
  @override
  Widget build(BuildContext context) =>
      RedeemScreen(balance: balance, requestsOnly: true);
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
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: EcoColors.body),
            ),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: strong ? FontWeight.w800 : FontWeight.w600,
                fontSize: strong ? 18 : 14,
                color: strong ? EcoColors.primary : EcoColors.ink,
              ),
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

/// How an approved reward reaches the resident, in the resident's words.
({String option, String waiting, String done}) _deliveryWords(
  Object? delivery,
) => switch (delivery) {
  'Email' => (
    option: 'sent by email',
    waiting: 'Being emailed',
    done: 'Emailed',
  ),
  'Post' => (option: 'sent by post', waiting: 'Being posted', done: 'Posted'),
  _ => (
    option: 'collect in person',
    waiting: 'Ready to collect',
    done: 'Collected',
  ),
};

/// The slip on an approved request: the code, how the reward arrives and,
/// once an admin records the hand-over, when that happened.
class _RewardSlip extends StatelessWidget {
  const _RewardSlip({required this.request});

  final Map<String, dynamic> request;

  @override
  Widget build(BuildContext context) {
    final code = request['collectionCode'] as String;
    final delivery = request['delivery'];
    final fulfilled = DateTime.tryParse(
      request['fulfilledAt'] as String? ?? '',
    )?.toLocal();
    final to = switch (delivery) {
      'Email' => request['residentEmail'] as String?,
      'Post' => request['deliveryAddress'] as String?,
      _ => null,
    };

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
      decoration: BoxDecoration(
        color: EcoColors.mintBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: fulfilled != null
          ? Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Text(
                '${_deliveryWords(delivery).done} on ${DateFormat('d MMM y').format(fulfilled)} · code $code',
                style: const TextStyle(fontSize: 13, color: EcoColors.body),
              ),
            )
          : Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        delivery == 'Email' || delivery == 'Post'
                            ? 'Your reference code'
                            : 'Your collection code',
                        style: const TextStyle(
                          fontSize: 12,
                          color: EcoColors.label,
                        ),
                      ),
                      SelectableText(
                        code,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                          letterSpacing: 1.5,
                          color: EcoColors.primary,
                        ),
                      ),
                      Text(
                        request['deliveryInstructions'] as String? ?? '',
                        style: const TextStyle(
                          fontSize: 13,
                          color: EcoColors.body,
                        ),
                      ),
                      if (to != null && to.isNotEmpty)
                        Text(
                          'To: $to',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: EcoColors.body,
                          ),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Copy code',
                  icon: const Icon(Icons.copy_rounded, size: 20),
                  color: EcoColors.primary,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: code));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Code copied')),
                    );
                  },
                ),
              ],
            ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.imageUrl,
    required this.busy,
    required this.onChange,
    required this.onCancel,
  });
  final Map<String, dynamic> request;
  final String? imageUrl;
  final bool busy;
  final VoidCallback onChange;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final status = request['status'] as String? ?? 'Pending';
    final hasSlip = status == 'Approved' && request['collectionCode'] != null;
    final words = _deliveryWords(request['delivery']);
    final label = !hasSlip
        ? status
        : request['fulfilledAt'] != null
        ? words.done
        : words.waiting;
    final name = request['reason'] as String? ?? 'Reward request';
    final created = DateTime.tryParse(
      request['createdAt'] as String? ?? '',
    )?.toLocal();
    final (Color fg, Color bg) = switch (status) {
      'Approved' => (EcoColors.green, EcoColors.honeydew),
      'Rejected' => (EcoColors.danger, EcoColors.dangerBg),
      _ => (EcoColors.amber, const Color(0xFFFFF4DC)),
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        clipBehavior: Clip.antiAlias,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: EcoColors.cardBorder),
        ),
        child: InkWell(
          onTap: () async {
            final action = await showModalBottomSheet<String>(
              context: context,
              isScrollControlled: true,
              useSafeArea: true,
              showDragHandle: true,
              backgroundColor: EcoColors.ivory,
              builder: (ctx) => SafeArea(
                top: false,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.sizeOf(ctx).height * .85,
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Request details',
                                style: TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                  color: EcoColors.green,
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: 'Close request details',
                              icon: const Icon(Icons.close_rounded),
                              onPressed: () => Navigator.pop(ctx),
                            ),
                          ],
                        ),
                        Center(
                          child: RewardArtwork(
                            imageUrl: imageUrl,
                            itemName: request['reason'] as String?,
                            size: 120,
                          ),
                        ),
                        const SizedBox(height: 16),
                        _RequestDetails(
                          request: request,
                          busy: busy,
                          onChange: () => Navigator.pop(ctx, 'change'),
                          onCancel: () => Navigator.pop(ctx, 'cancel'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
            if (!context.mounted) return;
            if (action == 'change') onChange();
            if (action == 'cancel') onCancel();
          },
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                RewardArtwork(
                  imageUrl: imageUrl,
                  itemName: request['reason'] as String?,
                  size: 56,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${request['points']} points${created == null ? '' : ' · ${DateFormat('d MMM').format(created)}'}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: EcoColors.body,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: bg,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: fg,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Tap for details',
                        style: TextStyle(fontSize: 12, color: EcoColors.green),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.chevron_right_rounded, color: EcoColors.green),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RequestDetails extends StatelessWidget {
  const _RequestDetails({
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
    final hasSlip = status == 'Approved' && request['collectionCode'] != null;
    final words = _deliveryWords(request['delivery']);
    final label = !hasSlip
        ? status
        : request['fulfilledAt'] != null
        ? words.done
        : words.waiting;
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
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${request['points']} points${created == null ? '' : ' · ${DateFormat('d MMM').format(created)}'}',
            style: const TextStyle(fontSize: 13, color: EcoColors.body),
          ),
          if (note != null && note.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Admin: $note',
              style: const TextStyle(fontSize: 13, color: EcoColors.label),
            ),
          ],
          if (hasSlip) _RewardSlip(request: request),
          if (pending) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 4,
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
