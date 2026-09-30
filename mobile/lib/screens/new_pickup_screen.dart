import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../services/api.dart';
import '../services/pickup_photo_service.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import 'pickup_submitted_screen.dart';

class NewPickupScreen extends StatefulWidget {
  const NewPickupScreen({super.key, this.onSubmitted});

  final VoidCallback? onSubmitted;

  @override
  State<NewPickupScreen> createState() => _NewPickupScreenState();
}

class _NewPickupScreenState extends State<NewPickupScreen> {
  final _api = Api();
  final _description = TextEditingController();
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  late final TextEditingController _dateLabel;
  bool _recurring = false;
  String _interval = 'Weekly';
  bool _loading = false;
  XFile? _photo;

  @override
  void initState() {
    super.initState();
    _dateLabel = TextEditingController(text: DateFormat('EEE, d MMM yyyy').format(_date));
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
    if (file != null) setState(() => _photo = file);
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

  Future<void> _submit() async {
    setState(() => _loading = true);
    try {
      String? photoUrl;
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
              'If this mentions row-level security, run supabase/pickup-photos-storage.sql '
              'in the Supabase SQL Editor. Otherwise create a public '
              '"${AppConfig.pickupPhotoBucket}" bucket.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
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
          const EcoBackHeader(title: 'New pickup'),
          Expanded(
            child: SingleChildScrollView(
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
                            child: Image.file(File(_photo!.path), fit: BoxFit.cover, width: double.infinity, height: double.infinity),
                          )
                        : null,
                  ),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Description'),
                  EcoTextField(controller: _description, maxLines: 3),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Preferred date'),
                  EcoTextField(
                    readOnly: true,
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                        initialDate: _date,
                      );
                      if (picked != null) {
                        setState(() {
                          _date = picked;
                          _dateLabel.text = DateFormat('EEE, d MMM yyyy').format(picked);
                        });
                      }
                    },
                    controller: _dateLabel,
                    suffix: const Icon(Icons.calendar_today, color: EcoColors.primary, size: 20),
                  ),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Pickup type'),
                  Row(
                    children: [
                      Expanded(child: _TypeChip(label: 'One-off', selected: !_recurring, onTap: () => setState(() => _recurring = false))),
                      const SizedBox(width: 10),
                      Expanded(child: _TypeChip(label: 'Recurring', selected: _recurring, onTap: () => setState(() => _recurring = true))),
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
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border.all(color: EcoColors.border),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: active ? EcoColors.primary : EcoColors.body,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: EcoPrimaryButton(label: 'Submit request', loading: _loading, onPressed: _submit),
          ),
        ],
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.label, required this.selected, required this.onTap});
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
          border: Border.all(color: selected ? EcoColors.primary : EcoColors.border, width: selected ? 1.5 : 1),
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
