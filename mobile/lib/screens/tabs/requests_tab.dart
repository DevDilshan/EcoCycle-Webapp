import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../utils/pickup_approval_ui.dart';
import '../pickup_detail_screen.dart';

class RequestsTab extends StatefulWidget {
  const RequestsTab({super.key});

  @override
  State<RequestsTab> createState() => RequestsTabState();
}

class RequestsTabState extends State<RequestsTab> {
  final _api = Api();
  int _filter = 0;
  bool _loading = true;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    setState(() => _loading = true);
    try {
      final json = await _api.get('/pickuprequests', query: {'pageSize': '50'});
      setState(() {
        _items = (json['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 1) {
      return _items.where((p) {
        final s = (p['status'] as String? ?? '').toLowerCase();
        return s != 'completed' && s != 'cancelled' && s != 'rejected';
      }).toList();
    }
    if (_filter == 2) {
      return _items
          .where(
            (p) => (p['status'] as String? ?? '').toLowerCase() == 'completed',
          )
          .toList();
    }
    return _items;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(22, 8, 22, 12),
          child: Text(
            'My requests',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: FilterPills(
            labels: const ['All', 'Active', 'Done'],
            selected: _filter,
            onSelect: (i) => setState(() => _filter = i),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _loading
              ? const Center(
                  child: CircularProgressIndicator(color: EcoColors.primary),
                )
              : RefreshIndicator(
                  onRefresh: reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                    itemCount: _filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, i) {
                      final p = _filtered[i];
                      return _RequestCard(
                        pickup: p,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                PickupDetailScreen(pickupId: p['id'] as String),
                          ),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.pickup, required this.onTap});
  final Map<String, dynamic> pickup;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final id = pickup['id'] as String;
    final status = pickup['status'] as String? ?? 'Pending';
    final hasApproval = pickup['hasApprovalRequest'] == true;
    final cat = pickup['category'] as String? ?? '';
    final desc = pickup['description'] as String? ?? 'Pickup';
    final date = pickup['preferredDate'] as String?;
    final (approvalLabel, approvalTone) = hasApproval
        ? residentApprovalBadge(pickup)
        : (status, toneForPickupStatus(status));
    final label = hasApproval ? approvalLabel : status;
    final tone = hasApproval ? approvalTone : toneForPickupStatus(status);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: EcoColors.cardBorder),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(shortPickupId(id), style: ecoMono()),
                StatusBadge(label: label, tone: tone),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              cat.isNotEmpty ? '$desc · $cat' : desc,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            const SizedBox(height: 2),
            Text(
              date != null
                  ? 'Submitted ${DateFormat('d MMM').format(DateTime.parse(date))}'
                  : status,
              style: const TextStyle(fontSize: 12, color: EcoColors.body),
            ),
          ],
        ),
      ),
    );
  }
}
