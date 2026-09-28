import 'package:flutter/material.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../utils/user_helpers.dart';
import '../widgets/eco_components.dart';

class PickupDetailScreen extends StatefulWidget {
  const PickupDetailScreen({super.key, required this.pickupId});

  final String pickupId;

  @override
  State<PickupDetailScreen> createState() => _PickupDetailScreenState();
}

class _PickupDetailScreenState extends State<PickupDetailScreen> {
  final _api = Api();
  Map<String, dynamic>? _pickup;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get('/pickuprequests/${widget.pickupId}');
      setState(() => _pickup = json as Map<String, dynamic>);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const EcoScreen(
        child: Center(
          child: CircularProgressIndicator(color: EcoColors.primary),
        ),
      );
    }
    final p = _pickup;
    if (p == null) {
      return const EcoScreen(
        child: Center(child: Text('Could not load request')),
      );
    }

    final title = '${p['description'] ?? 'Pickup'} · ${p['category'] ?? '—'}';
    final flagged = p['hasApprovalRequest'] == true;

    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(title: title, subtitle: shortPickupId(widget.pickupId)),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (flagged)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 14),
                      child: StatusBadge(
                        label: 'Pending admin approval',
                        tone: BadgeTone.pendingApproval,
                      ),
                    ),
                  const StripedPhotoZone(height: 130, subtitle: 'waste photo'),
                  const SizedBox(height: 16),
                  const Text(
                    'Pipeline progress',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      color: EcoColors.label,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _PipelineStep(
                    done: true,
                    title: 'Classifier Agent',
                    subtitle:
                        '${p['category'] ?? '—'} · ${p['confidence'] != null ? '${((p['confidence'] as num) * 100).round()}% confidence' : 'classified'}',
                  ),
                  _PipelineStep(
                    done: true,
                    title: 'Routing Agent',
                    subtitle: p['zoneName'] as String? ?? 'Zone assignment',
                  ),
                  _PipelineStep(
                    done: !flagged,
                    error: flagged,
                    title: 'Validator Agent',
                    subtitle: flagged
                        ? (p['flagReason'] as String? ??
                              'Flagged: needs approval')
                        : 'Validated',
                  ),
                  _PipelineStep(
                    done: false,
                    last: true,
                    title: 'Notifier Agent',
                    subtitle: flagged
                        ? 'Waiting on admin decision'
                        : 'Pending completion',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PipelineStep extends StatelessWidget {
  const _PipelineStep({
    required this.done,
    required this.title,
    required this.subtitle,
    this.error = false,
    this.last = false,
  });

  final bool done;
  final bool error;
  final bool last;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: error
                    ? EcoColors.danger
                    : (done ? EcoColors.primary : const Color(0xFFEEF3EE)),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                error ? '!' : (done ? '✓' : '4'),
                style: TextStyle(
                  fontSize: 12,
                  color: done || error ? Colors.white : EcoColors.muted,
                ),
              ),
            ),
            if (!last)
              Container(
                width: 2,
                height: 40,
                color: done ? EcoColors.primary : const Color(0xFFE0D3D0),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: done ? EcoColors.ink : EcoColors.muted,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: error ? EcoColors.danger : EcoColors.body,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
