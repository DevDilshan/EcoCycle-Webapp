import 'dart:io';
import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../app/eco_app_scope.dart';
import '../services/api.dart';
import '../services/pickup_photo_service.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import 'pickup_submitted_screen.dart';

class NewPickupScreen extends StatefulWidget {
  const NewPickupScreen({super.key, this.onSubmitted, this.existing});

  final VoidCallback? onSubmitted;

  /// When non-null, the screen edits this existing pickup (PUT) instead of
  /// creating a new one (POST). Pops `true` on a successful save.
  final Map<String, dynamic>? existing;

  @override
  State<NewPickupScreen> createState() => _NewPickupScreenState();
}

class _NewPickupScreenState extends State<NewPickupScreen> {
  late final Api _api;
  final _description = TextEditingController();
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  late final TextEditingController _dateLabel;
  bool _recurring = false;
  String _interval = 'Weekly';
  bool _loading = false;
  XFile? _photo;
  String? _existingPhotoUrl;

  bool get _isEditing => widget.existing != null;

  static const _allowedIntervals = ['Weekly', 'Bi-weekly'];
  String? _descriptionError;
  String? _dateError;
  String? _intervalError;

  @override
  void initState() {
    super.initState();
    _api = EcoAppScope.apiOf(context);
    final existing = widget.existing;
    if (existing != null) {
      _description.text = (existing['description'] as String?) ?? '';
      final parsed = DateTime.tryParse(
        existing['preferredDate'] as String? ?? '',
      );
      if (parsed != null) _date = parsed.toLocal();
      _recurring = existing['isRecurring'] == true;
      final interval = existing['recurrenceInterval'] as String?;
      if (interval != null && _allowedIntervals.contains(interval)) {
        _interval = interval;
      }
      _existingPhotoUrl = existing['photoUrl'] as String?;
    }
    _dateLabel = TextEditingController(
      text: DateFormat('EEE, d MMM yyyy').format(_date),
    );
  }

  @override
  void dispose() {
    _description.dispose();
    _dateLabel.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file != null && mounted) setState(() => _photo = file);
  }

  Future<void> _choosePhotoSource() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take photo'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from library'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source != null) await _pickPhoto(source);
  }

  bool _validate() {
    String? descErr;
    String? dateErr;
    String? intervalErr;

    final desc = _description.text.trim();
    if (desc.isEmpty) {
      descErr = 'Please describe the waste to be collected.';
    } else if (desc.length < 5) {
      descErr = 'Description must be at least 5 characters.';
    } else if (desc.length > 1000) {
      descErr = 'Description must be 1000 characters or fewer.';
    }

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final picked = DateTime(_date.year, _date.month, _date.day);
    if (picked.isBefore(today)) {
      dateErr = 'Preferred date cannot be in the past.';
    } else if (picked.isAfter(today.add(const Duration(days: 365)))) {
      dateErr = 'Preferred date must be within the next 12 months.';
    }

    if (_recurring && !_allowedIntervals.contains(_interval)) {
      intervalErr = 'Recurrence must be Weekly or Bi-weekly.';
    }

    setState(() {
      _descriptionError = descErr;
      _dateError = dateErr;
      _intervalError = intervalErr;
    });
    return descErr == null && dateErr == null && intervalErr == null;
  }

  Widget _fieldError(String text) => Padding(
    padding: const EdgeInsets.only(top: 6, left: 4),
    child: Text(
      text,
      style: const TextStyle(
        color: Color(0xFFB42318),
        fontSize: 12.5,
        fontWeight: FontWeight.w500,
      ),
    ),
  );

  Future<void> _submit() async {
    if (_loading || !_validate()) return;
    if (EcoAppScope.isPreview(context)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Design preview is read-only. Log in to send a pickup request.',
          ),
        ),
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _loading = true);
    try {
      String? photoUrl = _existingPhotoUrl;
      if (_photo != null) {
        photoUrl = await PickupPhotoService.upload(_photo!);
      }
      final body = {
        'description': _description.text.trim(),
        'preferredDate': _date.toUtc().toIso8601String(),
        'isRecurring': _recurring,
        if (_recurring) 'recurrenceInterval': _interval,
        if (photoUrl != null) 'photoUrl': photoUrl,
      };

      if (_isEditing) {
        await _api.put('/pickuprequests/${widget.existing!['id']}', body: body);
        widget.onSubmitted?.call();
        if (!mounted) return;
        Navigator.of(context).pop(true);
        return;
      }

      final created = await _api.post('/pickuprequests', body: body);
      widget.onSubmitted?.call();
      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => PickupSubmittedScreen(
            pickup: created as Map<String, dynamic>,
            localPhotoPath: _photo?.path,
          ),
        ),
      );
    } on StorageException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Photo upload failed: ${e.message}. '
              'Please try another photo or send your request without one.',
            ),
          ),
        );
      }
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
          EcoBackHeader(title: _isEditing ? 'Edit pickup' : 'New pickup'),
          Expanded(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  StripedPhotoZone(
                    onTap: _choosePhotoSource,
                    title: 'Take a photo of the waste',
                    subtitle: 'or upload from library',
                    child: _photo != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: kIsWeb
                                ? Image.network(
                                    _photo!.path,
                                    fit: BoxFit.cover,
                                    width: double.infinity,
                                    height: double.infinity,
                                  )
                                : Image.file(
                                    File(_photo!.path),
                                    fit: BoxFit.cover,
                                    width: double.infinity,
                                    height: double.infinity,
                                  ),
                          )
                        : (_existingPhotoUrl != null &&
                              _existingPhotoUrl!.isNotEmpty)
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: Image.network(
                              _existingPhotoUrl!,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Ready for a fresh start?',
                    style: TextStyle(
                      fontSize: 23,
                      fontWeight: FontWeight.w800,
                      color: EcoColors.green,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Add a photo if you can, tell us what you’re recycling, and choose your preferred day.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.6,
                      color: EcoColors.body,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const EcoFieldLabel('Description'),
                  EcoTextField(
                    controller: _description,
                    hint: 'e.g. Clean bottles and flattened cardboard',
                    maxLines: 3,
                  ),
                  if (_descriptionError != null)
                    _fieldError(_descriptionError!),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Preferred date'),
                  EcoTextField(
                    readOnly: true,
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                        initialDate: _date.isBefore(DateTime.now())
                            ? DateTime.now()
                            : _date,
                      );
                      if (picked != null) {
                        setState(() {
                          _date = picked;
                          _dateLabel.text = DateFormat(
                            'EEE, d MMM yyyy',
                          ).format(picked);
                        });
                      }
                    },
                    controller: _dateLabel,
                    suffix: const Icon(
                      Icons.calendar_today,
                      color: EcoColors.primary,
                      size: 20,
                    ),
                  ),
                  if (_dateError != null) _fieldError(_dateError!),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Pickup type'),
                  Row(
                    children: [
                      Expanded(
                        child: _TypeChip(
                          label: 'One-off',
                          selected: !_recurring,
                          onTap: () => setState(() => _recurring = false),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _TypeChip(
                          label: 'Recurring',
                          selected: _recurring,
                          onTap: () => setState(() => _recurring = true),
                        ),
                      ),
                    ],
                  ),
                  if (_recurring) ...[
                    const SizedBox(height: 20),
                    const EcoFieldLabel('Repeat'),
                    Wrap(
                      spacing: 8,
                      children: ['Weekly', 'Bi-weekly'].map((label) {
                        final active = _interval == label;
                        return GestureDetector(
                          onTap: () => setState(() => _interval = label),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: active ? EcoColors.mintBg : Colors.white,
                              border: Border.all(
                                color: active
                                    ? EcoColors.primary
                                    : EcoColors.border,
                                width: active ? 1.5 : 1,
                              ),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: active
                                    ? EcoColors.primary
                                    : EcoColors.body,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    if (_intervalError != null) _fieldError(_intervalError!),
                  ],
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: EcoPrimaryButton(
              label: _isEditing ? 'Save changes' : 'Submit request',
              loading: _loading,
              onPressed: _submit,
            ),
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? EcoColors.mintBg : Colors.white,
          border: Border.all(
            color: selected ? EcoColors.primary : EcoColors.border,
            width: selected ? 1.5 : 1,
          ),
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
            fontSize: 14,
            color: selected ? EcoColors.primary : EcoColors.body,
          ),
        ),
      ),
    );
  }
}
