import 'package:flutter/material.dart';

import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_loading.dart';
import 'stop_detail_screen.dart';

class CollectorRouteScreen extends StatefulWidget {
  const CollectorRouteScreen({super.key, required this.collectorId});

  final String collectorId;

  @override
  State<CollectorRouteScreen> createState() => _CollectorRouteScreenState();
}

class _CollectorRouteScreenState extends State<CollectorRouteScreen> {
  final _api = Api();
  List<Map<String, dynamic>> _stops = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get('/routes/${widget.collectorId}/today');
      setState(() {
        _stops = (json as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const EcoLoadingState(title: 'Loading your EcoCycle', message: 'Bringing your latest details together.', compact: true);
    }

    final done = _stops.where((s) => (s['status'] as String? ?? '').toLowerCase() == 'completed').length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(22, 0, 22, 8),
        children: [
          Row(
            children: [
              _StatBox(value: '${_stops.length}', label: 'Stops'),
              const SizedBox(width: 8),
              _StatBox(value: '$done', label: 'Done', highlight: true),
              const SizedBox(width: 8),
              _StatBox(value: '${_stops.length - done}', label: 'Left', warn: true),
            ],
          ),
          const SizedBox(height: 12),
          ...List.generate(_stops.length, (i) {
            final s = _stops[i];
            final n = i + 1;
            final isNext = i == done;
            final completed = (s['status'] as String? ?? '').toLowerCase() == 'completed';
            return GestureDetector(
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => StopDetailScreen(stop: s, stopNumber: n),
                ),
              ),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: completed ? const Color(0xFFF3F6F2) : Colors.white,
                  border: Border.all(color: EcoColors.cardBorder),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: completed ? EcoColors.primary : const Color(0xFFEEF3EE),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        completed ? '✓' : '$n',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                          color: completed ? Colors.white : EcoColors.body,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            s['address'] as String? ?? s['description'] as String? ?? 'Stop $n',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              decoration: completed ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          Text(
                            s['category'] as String? ?? s['notes'] as String? ?? '',
                            style: const TextStyle(fontSize: 12, color: EcoColors.body),
                          ),
                        ],
                      ),
                    ),
                    if (isNext && !completed)
                      const StatusBadge(label: 'Next', tone: BadgeTone.next)
                    else
                      const Icon(Icons.chevron_right, color: EcoColors.muted),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.value, required this.label, this.highlight = false, this.warn = false});
  final String value;
  final String label;
  final bool highlight;
  final bool warn;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: EcoColors.cardBorder),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 18,
                color: warn ? EcoColors.amber : (highlight ? EcoColors.primary : EcoColors.ink),
              ),
            ),
            Text(label, style: const TextStyle(fontSize: 10, color: EcoColors.body)),
          ],
        ),
      ),
    );
  }
}
