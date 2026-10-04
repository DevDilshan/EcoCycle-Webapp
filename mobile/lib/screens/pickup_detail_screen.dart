import 'package:flutter/material.dart';

import '../services/api.dart';
import '../services/pickup_photo_service.dart';
import '../widgets/waste_photo_preview.dart';
import '../theme/eco_theme.dart';
import '../utils/user_helpers.dart';
import '../widgets/eco_components.dart';
import '../widgets/resident_approval_banner.dart';
import '../utils/pickup_approval_ui.dart';
import 'new_pickup_screen.dart';

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
  bool _busy = false;

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

  Future<void> _edit() async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (_) => NewPickupScreen(existing: _pickup)),
    );
    if (changed == true && mounted) {
      setState(() => _loading = true);
      await _load();
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: const Text('This permanently removes your pending pickup request.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: EcoColors.danger),
            child: const Text('Cancel request'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await _api.delete('/pickuprequests/${widget.pickupId}');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
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
    final approval = pickupApprovalStatus(p)?.toLowerCase();
    final approvalPending = approval == 'pending';
    final approvalRejected = approval == 'rejected';
    final isPending = (p['status'] as String?)?.toLowerCase() == 'pending';

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
                  ResidentApprovalBanner(pickup: p),
                  WastePhotoPreview(
                    height: 130,
                    subtitle: 'waste photo',
                    photoUrl: pickupPhotoUrl(p),
                  ),
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
                    done: !approvalPending && !approvalRejected,
                    error: approvalPending || approvalRejected,
                    title: 'Validator Agent',
                    subtitle: approvalRejected
                        ? 'Review complete — not approved'
                        : approvalPending
                            ? (p['flagReason'] as String? ??
                                  'Flagged: needs approval')
                            : 'Validated',
                  ),
                  _PipelineStep(
                    done: approval == 'approved',
                    error: approvalRejected,
                    last: true,
                    title: 'Admin review',
                    subtitle: approvalRejected
                        ? (p['approvalReviewNotes'] as String? ??
                              'Your pickup was not approved.')
                        : approvalPending
                            ? 'Waiting on admin decision'
                            : approval == 'approved'
                                ? 'Approved — scheduling in progress'
                                : 'Not required',
                  ),
                ],
              ),
            ),
          ),
          if (isPending)
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
              child: Row(
                children: [
                  Expanded(
                    child: EcoPrimaryButton(
                      label: 'Edit',
                      icon: Icons.edit_outlined,
                      onPressed: _busy ? null : _edit,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: EcoPrimaryButton(
                      label: 'Cancel request',
                      color: EcoColors.danger,
                      loading: _busy,
                      onPressed: _cancel,
                    ),
                  ),
                ],
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
