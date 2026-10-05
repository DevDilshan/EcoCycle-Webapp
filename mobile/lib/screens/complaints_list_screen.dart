import '../app/eco_app_scope.dart';
import 'package:flutter/material.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_loading.dart';
import 'new_complaint_screen.dart';

class ComplaintsListScreen extends StatefulWidget {
  const ComplaintsListScreen({super.key});

  @override
  State<ComplaintsListScreen> createState() => _ComplaintsListScreenState();
}

class _ComplaintsListScreenState extends State<ComplaintsListScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  bool _loading = true;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      // The list is paged: the complaints are under "items".
      final json = await _api.get(
        '/complaints',
        query: {'sortDir': 'desc', 'pageSize': '50'},
      );
      final items = json is Map ? json['items'] : json;
      setState(() {
        _items = (items as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(title: 'My complaints', subtitle: null),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: EcoPrimaryButton(
              label: 'New complaint',
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const NewComplaintScreen(),
                  ),
                );
                _load();
              },
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? const EcoLoadingState(
                    title: 'Loading your EcoCycle',
                    message: 'Bringing your latest details together.',
                    compact: true,
                  )
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                    itemCount: _items.length,
                    itemBuilder: (context, i) {
                      final c = _items[i];
                      final status = c['status'] as String? ?? 'Open';
                      final resolved = status.toLowerCase() == 'resolved';
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
                            Wrap(
                              alignment: WrapAlignment.spaceBetween,
                              spacing: 12,
                              runSpacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  '#CMP-${(c['id'] as String?)?.substring(0, 4).toUpperCase() ?? '—'}',
                                  style: ecoMono(),
                                ),
                                StatusBadge(
                                  label: status == 'InReview'
                                      ? 'In review'
                                      : status,
                                  tone: resolved
                                      ? BadgeTone.resolved
                                      : BadgeTone.inReview,
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              c['issueType'] as String? ?? 'Complaint',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              c['description'] as String? ?? '',
                              style: const TextStyle(
                                fontSize: 13,
                                color: EcoColors.body,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
