import '../app/eco_app_scope.dart';
import 'package:flutter/material.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';

class NewComplaintScreen extends StatefulWidget {
  const NewComplaintScreen({super.key});

  @override
  State<NewComplaintScreen> createState() => _NewComplaintScreenState();
}

class _NewComplaintScreenState extends State<NewComplaintScreen> {
  late final Api _api = EcoAppScope.apiOf(context);
  final _description = TextEditingController();
  String _issue = 'Missed pickup';
  bool _loading = false;

  static const _issues = ['Missed pickup', 'Late', 'Damage', 'Other'];

  @override
  void dispose() {
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      await _api.post(
        '/complaints',
        body: {'issueType': _issue, 'description': _description.text.trim()},
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                              fontSize: 12,
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
                  EcoTextField(controller: _description, maxLines: 4),
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
              loading: _loading,
              onPressed: _submit,
            ),
          ),
        ],
      ),
    );
  }
}
