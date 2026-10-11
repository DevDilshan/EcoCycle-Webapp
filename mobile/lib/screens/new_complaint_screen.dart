import '../app/eco_app_scope.dart';
import 'package:flutter/material.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_feature.dart';
import '../widgets/eco_loading.dart';

class NewComplaintScreen extends StatefulWidget {
  const NewComplaintScreen({super.key});

  @override
  State<NewComplaintScreen> createState() => _NewComplaintScreenState();
}

class _NewComplaintScreenState extends State<NewComplaintScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  final _description = TextEditingController();
  String _issue = 'Missed pickup';
  String? _pickupRequestId;
  List<Map<String, dynamic>> _pickups = [];
  bool _loadingPickups = true;
  bool _submitting = false;
  String? _pickupError;
  String? _descriptionError;

  static const _issues = ['Missed pickup', 'Late', 'Damage', 'Other'];
  static const _descriptionMin = 10;

  @override
  void initState() {
    super.initState();
    _loadPickups();
  }

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _loadPickups() async {
    try {
      final json = await _api.get('/pickuprequests', query: {'pageSize': '50'});
      final items = json is Map ? json['items'] : json;
      final list = (items as List?)?.cast<Map<String, dynamic>>() ?? [];
      list.sort((a, b) {
        final ad = DateTime.tryParse(a['preferredDate'] as String? ?? '');
        final bd = DateTime.tryParse(b['preferredDate'] as String? ?? '');
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return bd.compareTo(ad);
      });
      if (mounted) {
        setState(() {
          _pickups = list;
          _loadingPickups = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingPickups = false;
          _pickupError = 'Could not load your pickups. Pull back and try again.';
        });
      }
    }
  }

  String _buildDescription() {
    final body = _description.text.trim();
    if (_issue == 'Other') return body;
    return '[$_issue] $body';
  }

  Future<void> _submit() async {
    final pickupId = _pickupRequestId;
    final desc = _buildDescription();

    setState(() {
      _pickupError = null;
      _descriptionError = null;
      if (pickupId == null || pickupId.isEmpty) {
        _pickupError = 'Choose the pickup this complaint is about.';
      }
      if (desc.length < _descriptionMin) {
        _descriptionError =
            'Use at least $_descriptionMin characters so support can help.';
      }
    });

    if (_pickupError != null || _descriptionError != null) return;

    setState(() => _submitting = true);
    try {
      await _api.post(
        '/complaints',
        body: {
          'pickupRequestId': pickupId,
          'description': desc,
        },
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _pickupSelector() {
    if (_loadingPickups) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: EcoLoadingState(
          title: 'Loading pickups',
          message: 'Finding requests on your account.',
          compact: true,
        ),
      );
    }

    if (_pickups.isEmpty) {
      return Text(
        'You need at least one pickup request before filing a complaint.',
        style: TextStyle(fontSize: 13, color: EcoColors.muted, height: 1.45),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            color: EcoColors.surface,
            border: Border.all(
              color: _pickupError != null
                  ? EcoColors.danger
                  : EcoColors.green.withValues(alpha: 0.12),
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _pickupRequestId,
              isExpanded: true,
              hint: const Text(
                'Select a pickup request…',
                style: TextStyle(fontSize: 14, color: EcoColors.muted),
              ),
              items: _pickups
                  .map(
                    (pickup) => DropdownMenuItem<String>(
                      value: pickup['id'] as String?,
                      child: Text(
                        pickupComplaintLabel(pickup),
                        style: const TextStyle(
                          fontSize: 14,
                          color: EcoColors.ink,
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                _pickupRequestId = value;
                _pickupError = null;
              }),
            ),
          ),
        ),
        if (_pickupError != null) ...[
          const SizedBox(height: 6),
          Text(
            _pickupError!,
            style: const TextStyle(
              fontSize: 12,
              color: EcoColors.danger,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !_loadingPickups && _pickups.isNotEmpty && !_submitting;

    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EcoBackHeader(title: 'New complaint'),
          Expanded(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const EcoFieldLabel('Which pickup is it about?'),
                  _pickupSelector(),
                  const SizedBox(height: 18),
                  const EcoFieldLabel('Issue type'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _issues.map((label) {
                      final active = _issue == label;
                      final isMissed = label == 'Missed pickup';
                      return GestureDetector(
                        onTap: () => setState(() => _issue = label),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: active && isMissed
                                ? const Color(0xFFF7E3E0)
                                : Colors.white,
                            border: Border.all(
                              color: active
                                  ? (isMissed
                                        ? EcoColors.danger
                                        : EcoColors.primary)
                                  : EcoColors.border,
                              width: active ? 1.5 : 1,
                            ),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: active
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: active && isMissed
                                  ? EcoColors.danger
                                  : EcoColors.body,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 18),
                  const EcoFieldLabel('What happened?'),
                  EcoTextField(
                    controller: _description,
                    maxLines: 4,
                    hint:
                        'e.g. The crew missed my bags on the scheduled day…',
                  ),
                  if (_descriptionError != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      _descriptionError!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: EcoColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  const EcoFieldLabel('Add photo (optional)'),
                  const StripedPhotoZone(height: 80, subtitle: 'tap to attach'),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: EcoPrimaryButton(
              label: 'Submit complaint',
              loading: _submitting,
              onPressed: canSubmit ? _submit : null,
            ),
          ),
        ],
      ),
    );
  }
}
