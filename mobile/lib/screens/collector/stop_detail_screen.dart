import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../services/pickup_photo_service.dart';
import '../../theme/eco_theme.dart';
import '../../utils/user_helpers.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/waste_photo_preview.dart';

/// One stop on the collector's round. Pops `true` when the stop was marked
/// collected or not collected, so the route list knows to reload.
class StopDetailScreen extends StatefulWidget {
  const StopDetailScreen({
    super.key,
    required this.stop,
    required this.stopNumber,
  });

  final Map<String, dynamic> stop;
  final int stopNumber;

  @override
  State<StopDetailScreen> createState() => _StopDetailScreenState();
}

class _StopDetailScreenState extends State<StopDetailScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  bool _busy = false;
  String? _error;

  String get _routeId => widget.stop['id'] as String? ?? '';

  Future<void> _send(String action, {String? notes}) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await _api.patch(
        '/routes/$_routeId/$action',
        body: {'issueNotes': notes},
      );
      if (!mounted) return;

      // Reporting a stop as not collected books the pickup again. Saying nothing
      // about that left the collector unsure whether the resident would be
      // visited, and a rebooking that failed looked exactly like one that
      // worked. The snackbar is shown before the pop on purpose: the messenger
      // lives above this route, so it survives the screen closing.
      if (action == 'missed') {
        final map = result is Map ? result : const {};
        final rescheduled = map['rescheduled'] == true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              rescheduled
                  ? 'Reported. It has been booked onto a later round.'
                  : 'Reported. The office will arrange another visit.',
            ),
          ),
        );
      }

      Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reportNotCollected() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => const _ReasonDialog(),
    );
    if (reason != null && mounted) await _send('missed', notes: reason);
  }

  @override
  Widget build(BuildContext context) {
    final stop = widget.stop;
    final pickupId = stop['pickupRequestId'] as String? ?? '';
    final completion = stop['completion'] as String? ?? 'Pending';
    final pending = completion == 'Pending';
    final address = (stop['address'] as String?)?.trim();
    final description = (stop['description'] as String?)?.trim();
    final category = stop['category'] as String?;
    final resident = (stop['residentName'] as String?)?.trim();
    final phone = (stop['residentPhone'] as String?)?.trim();
    final confidence = (stop['confidence'] as num?)?.toDouble();
    final requestedAt = DateTime.tryParse(stop['requestedAt'] as String? ?? '');
    final carriedOver = stop['carriedOver'] == true;
    final scheduled = DateTime.tryParse(stop['scheduledDate'] as String? ?? '');
    final notes = (stop['issueNotes'] as String?)?.trim();

    final (statusLabel, statusTone) = switch (completion) {
      'Completed' => ('Collected', BadgeTone.completed),
      'Missed' => ('Not collected', BadgeTone.inReview),
      _ => ('To collect', BadgeTone.scheduled),
    };

    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EcoBackHeader(
            title: 'Stop ${widget.stopNumber}',
            subtitle: pickupId.isNotEmpty ? shortPickupId(pickupId) : null,
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    resident?.isNotEmpty == true
                        ? resident!
                        : (address?.isNotEmpty == true
                              ? address!
                              : 'Address not provided'),
                    style: const TextStyle(
                      fontSize: 24,
                      height: 1.25,
                      letterSpacing: -.4,
                      fontWeight: FontWeight.w800,
                      color: EcoColors.green,
                    ),
                  ),
                  if (resident?.isNotEmpty == true &&
                      address?.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(
                      address!,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.4,
                        color: EcoColors.body,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      StatusBadge(label: statusLabel, tone: statusTone),
                      if (category != null && category.isNotEmpty)
                        StatusBadge(label: category, tone: BadgeTone.category),
                      if (stop['isBulkRequest'] == true)
                        const StatusBadge(
                          label: 'Bulky — needs a lift',
                          tone: BadgeTone.next,
                        ),
                      // An earlier round never got to this one, which is why it
                      // is on today's list at all.
                      if (carriedOver)
                        const StatusBadge(
                          label: 'Not collected earlier',
                          tone: BadgeTone.inReview,
                        ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  WastePhotoPreview(
                    height: 150,
                    subtitle: 'resident’s waste photo',
                    photoUrl: pickupPhotoUrl(stop),
                  ),
                  const SizedBox(height: 18),
                  EcoCard(
                    child: Column(
                      children: [
                        if (phone?.isNotEmpty == true) ...[
                          _Detail(
                            icon: Icons.phone_outlined,
                            label: 'Phone',
                            value: phone!,
                          ),
                          const Divider(height: 24, color: EcoColors.border),
                        ],
                        _Detail(
                          icon: Icons.inventory_2_outlined,
                          label: 'Items',
                          value: description?.isNotEmpty == true
                              ? description!
                              : 'Not described',
                        ),
                        if (category != null && category.isNotEmpty) ...[
                          const Divider(height: 24, color: EcoColors.border),
                          _Detail(
                            icon: Icons.category_outlined,
                            label: 'Category',
                            value: confidence != null
                                ? '$category · ${(confidence.clamp(0, 1) * 100).round()}% sure'
                                : category,
                          ),
                        ],
                        if (requestedAt != null) ...[
                          const Divider(height: 24, color: EcoColors.border),
                          _Detail(
                            icon: Icons.schedule_outlined,
                            label: 'Requested',
                            // How long it has waited, which is what a resident
                            // asks about when they ring.
                            value: DateFormat(
                              'EEE, d MMM yyyy',
                            ).format(requestedAt.toLocal()),
                          ),
                        ],
                        if (stop['zoneName'] is String) ...[
                          const Divider(height: 24, color: EcoColors.border),
                          _Detail(
                            icon: Icons.place_outlined,
                            label: 'Area',
                            value: stop['zoneName'] as String,
                          ),
                        ],
                        if (scheduled != null) ...[
                          const Divider(height: 24, color: EcoColors.border),
                          _Detail(
                            icon: Icons.event_outlined,
                            label: 'Scheduled',
                            value: DateFormat(
                              'EEE, d MMM',
                            ).format(scheduled.toLocal()),
                          ),
                        ],
                        if (notes?.isNotEmpty == true) ...[
                          const Divider(height: 24, color: EcoColors.border),
                          _Detail(
                            icon: Icons.sticky_note_2_outlined,
                            label: 'Note',
                            value: notes!,
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      _error!,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.5,
                        color: EcoColors.danger,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (pending)
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  EcoPrimaryButton(
                    label: 'Mark as collected',
                    icon: Icons.check_rounded,
                    loading: _busy,
                    onPressed: _busy ? null : () => _send('complete'),
                  ),
                  const SizedBox(height: 10),
                  EcoDangerButton(
                    label: 'Couldn’t collect this stop',
                    icon: Icons.report_gmailerrorred_rounded,
                    onPressed: _busy ? null : _reportNotCollected,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 20, color: EcoColors.green),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: EcoColors.body,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                height: 1.45,
                fontWeight: FontWeight.w600,
                color: EcoColors.ink,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

/// Asks why the stop could not be collected. The reason is shown to the
/// office and, reworded, to the resident, so it cannot be left empty.
class _ReasonDialog extends StatefulWidget {
  const _ReasonDialog();

  @override
  State<_ReasonDialog> createState() => _ReasonDialogState();
}

class _ReasonDialogState extends State<_ReasonDialog> {
  final _reason = TextEditingController();

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = _reason.text.trim();
    return AlertDialog(
      backgroundColor: EcoColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      title: const Text(
        'What stopped the collection?',
        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
      ),
      content: TextField(
        controller: _reason,
        autofocus: true,
        minLines: 2,
        maxLines: 4,
        maxLength: 300,
        textCapitalization: TextCapitalization.sentences,
        decoration: const InputDecoration(
          hintText: 'For example: gate locked, bin not out',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: text.isEmpty
              ? null
              : () => Navigator.of(context).pop(text),
          style: TextButton.styleFrom(foregroundColor: EcoColors.danger),
          child: const Text(
            'Report',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ],
    );
  }
}
