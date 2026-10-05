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
import 'pickup_location_screen.dart';
import '../services/map_location.dart';
import 'package:latlong2/latlong.dart';

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
  final _contactPhone = TextEditingController();
  final _address = TextEditingController();

  /// Active zones for the picker, from /zones/selectable.
  List<Map<String, dynamic>> _zones = [];
  String? _zoneId;
  LatLng? _point;

  static const _dayNames = [
    'Sundays',
    'Mondays',
    'Tuesdays',
    'Wednesdays',
    'Thursdays',
    'Fridays',
    'Saturdays',
  ];

  /// DayOfWeek numbers the chosen zone is collected on, empty when no zone is
  /// chosen or the zone has no fixed days.
  List<int> get _collectionDays {
    final zone = _zones.firstWhere(
      (z) => z['id'] == _zoneId,
      orElse: () => const <String, dynamic>{},
    );
    final days = zone['collectionDays'];
    return days is List ? days.whereType<int>().toList() : const [];
  }

  /// Dart's DateTime.weekday is 1..7 with Monday first; the API sends
  /// DayOfWeek, 0..6 with Sunday first. Sunday is 7 here and 0 there.
  bool _isCollectionDay(DateTime day) {
    final days = _collectionDays;
    if (days.isEmpty) return true;
    return days.contains(day.weekday % 7);
  }

  /// The soonest collectable day from tomorrow on, or null when the zone has no
  /// fixed days (any date will do) or none falls in the next four weeks.
  DateTime? _nextCollectionDay() {
    if (_collectionDays.isEmpty) return null;
    final today = DateTime.now();
    for (var i = 1; i <= 28; i += 1) {
      final day = DateTime(today.year, today.month, today.day + i);
      if (_isCollectionDay(day)) return day;
    }
    return null;
  }

  /// "Dehiwala is collected on Mondays and Sundays." Null until a zone is
  /// chosen, so the hint does not appear before it means anything.
  String? get _collectionDaysLabel {
    final zone = _zones.firstWhere(
      (z) => z['id'] == _zoneId,
      orElse: () => const <String, dynamic>{},
    );
    final name = zone['name'] as String?;
    if (name == null) return null;
    final names = _collectionDays
        .where((d) => d >= 0 && d < 7)
        .map((d) => _dayNames[d])
        .toList();
    if (names.isEmpty) return '$name has no fixed collection days.';
    final joined = names.length > 1
        ? '${names.sublist(0, names.length - 1).join(', ')} and ${names.last}'
        : names.first;
    return '$name is collected on $joined.';
  }

  DateTime _date = DateTime.now().add(const Duration(days: 1));
  late final TextEditingController _dateLabel;
  bool _recurring = false;
  String? _interval;
  bool _loading = false;

  /// True while the agent pipeline runs, after the pickup itself is saved.
  bool _classifying = false;
  XFile? _photo;
  String? _existingPhotoUrl;
  bool _validatingPhoto = false;

  bool get _isEditing => widget.existing != null;

  static const _allowedIntervals = ['Weekly', 'Bi-weekly'];

  /// Kept in step with COLLECTION_WINDOW_LABEL in frontend/src/lib/collectorUi.js.
  static const _collectionWindowLabel = '8:30 am – 4:00 pm';

  bool _isBulkRequest = false;

  /// This month's bulky allowance, null until loaded or if the request failed.
  Map<String, dynamic>? _bulkAllowance;

  /// Checked on the phone purely to prompt the resident. The classifier runs
  /// after submission, so it can never warn them while they can still change
  /// the answer; a plain word list catches the honest cases at the right moment.
  static const _bulkyWords = [
    'sofa',
    'couch',
    'settee',
    'mattress',
    'bed frame',
    'wardrobe',
    'dresser',
    'furniture',
    'armchair',
    'table',
    'fridge',
    'freezer',
    'washing machine',
  ];

  bool get _looksBulky {
    final text = _description.text.toLowerCase();
    return _bulkyWords.any(text.contains);
  }

  int? get _bulkRemaining => _bulkAllowance?['remaining'] as int?;

  /// Whether a contact number could be dialled. Separators are stripped before
  /// the digits are counted, so a resident is not refused over a space they
  /// cannot see. 9 to 15 digits is the E.164 range, so a local 0771234567 and an
  /// international +94771234567 are both accepted.
  static bool _isDialable(String phone) {
    final trimmed = phone.trim();
    if (trimmed.isEmpty) return false;
    // A plus is allowed only as the first character.
    final body = trimmed.startsWith('+') ? trimmed.substring(1) : trimmed;
    if (RegExp(r'[^0-9\s\-()]').hasMatch(body)) return false;
    final digits = body.replaceAll(RegExp(r'[^0-9]'), '').length;
    return digits >= 9 && digits <= 15;
  }

  /// When the bulky allowance next resets: the 1st of next month. The server
  /// counts bulky pickups from the start of the current calendar month, so this
  /// is the first day a refused resident can book one again. Naming the day is
  /// kinder than "the 1st", which leaves them to work out which 1st.
  String get _bulkResetLabel {
    final now = DateTime.now();
    return DateFormat('d MMMM').format(DateTime(now.year, now.month + 1, 1));
  }

  /// Whether a new bulky collection can still be declared. Unticking one
  /// already ticked stays possible, so a resident cannot get stuck.
  bool get _bulkLocked => _bulkRemaining == 0 && !_isBulkRequest;
  int? get _bulkLimit => _bulkAllowance?['limit'] as int?;
  String? _descriptionError;
  String? _contactPhoneError;
  String? _addressError;
  String? _zoneError;
  String? _bulkError;
  String? _photoError;
  String? _dateError;
  String? _intervalError;

  @override
  void initState() {
    super.initState();
    _api = EcoAppScope.apiOf(context);
    final existing = widget.existing;
    if (existing != null) {
      _description.text = (existing['description'] as String?) ?? '';
      _contactPhone.text = (existing['contactPhone'] as String?) ?? '';
      _address.text = (existing['address'] as String?) ?? '';
      _zoneId = existing['zoneId'] as String?;
      _point = pickupPoint(existing);
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
    // Only when creating: the update endpoint takes no zone, so the picker is
    // not shown on an edit and the list would be fetched for nothing.
    if (!_isEditing) {
      _loadZones();
      _loadBulkAllowance();
    }
  }

  /// What is left of this month's bulky allowance, so the form can say so
  /// before they book rather than the server refusing afterwards. Failure is
  /// swallowed: the count is a courtesy, and the server enforces the limit.
  Future<void> _loadBulkAllowance() async {
    try {
      final data = await _api.get('/pickuprequests/bulk-allowance');
      if (!mounted || data is! Map) return;
      setState(() => _bulkAllowance = data.cast<String, dynamic>());
    } catch (_) {
      // Left null; the allowance line is simply not shown.
    }
  }

  /// The zones a resident may choose. Failure is swallowed: it costs the picker,
  /// not the screen, and _validate still refuses to submit without a zone.
  Future<void> _loadZones() async {
    try {
      final data = await _api.get('/zones/selectable');
      if (!mounted || data is! List) return;
      setState(() => _zones = data.cast<Map<String, dynamic>>());
    } catch (_) {
      // Left empty on purpose; the field shows its own unavailable state.
    }
  }

  Future<void> _choosePoint() async {
    final zone = _zones.where((z) => z['id'] == _zoneId).firstOrNull;
    final point = await Navigator.of(context).push<LatLng>(
      MaterialPageRoute(
        builder: (_) => PickupLocationScreen(
          point: _point,
          center: zone == null ? null : pickupPoint(zone),
        ),
      ),
    );
    if (point != null && mounted) setState(() => _point = point);
  }

  @override
  void dispose() {
    _description.dispose();
    _contactPhone.dispose();
    _address.dispose();
    _dateLabel.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: source, imageQuality: 85);
    if (file != null && mounted) {
      setState(() {
        _photo = file;
        _photoError = null;
      });
    }
  }

  // After upload, ask the backend (OpenAI vision) whether the photo is a clear
  // image of actual waste. Returns a user-facing message when it is not, or null
  // to proceed. Fail-open: an unavailable check returns null (does not block).
  Future<String?> _photoValidationError(String photoUrl) async {
    try {
      final res = await _api.post(
        '/pickuprequests/validate-photo',
        body: {'photoUrl': photoUrl},
      );
      final map = res as Map<String, dynamic>?;
      if (map == null || map['checked'] != true) return null;
      if (map['isClear'] == false) {
        return 'The photo is not clear. '
            'Please upload a clearer photo of the waste.';
      }
      if (map['isWaste'] == false) {
        return 'The photo is not waste. '
            'Please upload a photo of the waste to collect.';
      }
      return null;
    } catch (_) {
      return null; // validation unavailable -> do not block the submission
    }
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
    String? phoneErr;
    String? addressErr;
    String? zoneErr;
    String? bulkErr;
    String? photoErr;

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
    } else if (!_isCollectionDay(picked)) {
      // The picker already blocks these, but the date survives a zone change,
      // so this catches a day that was valid for the zone chosen before.
      dateErr = 'That zone is not collected on this day.';
    }

    if (_recurring) {
      if (_interval == null) {
        intervalErr = 'Choose how often the pickup repeats.';
      } else if (!_allowedIntervals.contains(_interval)) {
        intervalErr = 'Recurrence must be Weekly or Bi-weekly.';
      }
    }

    // Zone and address are required by the server on create, and the update
    // endpoint accepts neither -- so both are checked only when creating.
    if (!_isEditing) {
      if (_zoneId == null || _zoneId!.isEmpty) {
        zoneErr = 'Please choose the zone this pickup is in.';
      }
      final addr = _address.text.trim();
      if (addr.length < 5) {
        addressErr = 'Please give your house number and street.';
      } else if (addr.length > 300) {
        addressErr = 'Address must be 300 characters or fewer.';
      }
    }

    // Required on create: the classifier reads the photo, and without one the
    // category rests entirely on how the resident happened to word the
    // description. An edit keeps whatever photo the request already carries.
    if (!_isEditing && _photo == null) {
      photoErr = 'Please add a photo of the waste so it can be classified.';
    }

    // The checkbox is disabled once the allowance is spent, but the box can be
    // ticked while one is left and the allowance spent elsewhere before this
    // submits. Caught here so the resident is told before the photo uploads.
    if (!_isEditing && _isBulkRequest && _bulkRemaining == 0) {
      bulkErr = 'You have no bulky collections left this month.';
    }

    // Required on a new request, so the crew has a way to reach whoever is at
    // the collection. Left optional when editing: the stored number is kept if
    // the field is blank, and the server does the same.
    final phone = _contactPhone.text.trim();
    if (phone.isEmpty) {
      if (!_isEditing) phoneErr = 'Please give a number the crew can call.';
    } else if (!_isDialable(phone)) {
      phoneErr = 'Please give a valid contact number, e.g. 0771234567.';
    }

    setState(() {
      _descriptionError = descErr;
      _dateError = dateErr;
      _intervalError = intervalErr;
      _contactPhoneError = phoneErr;
      _addressError = addressErr;
      _zoneError = zoneErr;
      _bulkError = bulkErr;
      _photoError = photoErr;
    });
    return descErr == null &&
        dateErr == null &&
        intervalErr == null &&
        phoneErr == null &&
        addressErr == null &&
        zoneErr == null &&
        bulkErr == null &&
        photoErr == null;
  }

  /// The small grey note under a field, as the web form has beneath the
  /// address, the contact number and the date.
  Widget _fieldHint(String text) => Padding(
    padding: const EdgeInsets.only(top: 6, left: 4),
    child: Text(
      text,
      style: const TextStyle(fontSize: 12.5, color: EcoColors.body),
    ),
  );

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
    setState(() {
      _loading = true;
      _photoError = null;
    });
    try {
      String? photoUrl = _existingPhotoUrl;
      if (_photo != null) {
        photoUrl = await PickupPhotoService.upload(_photo!);
        if (mounted) setState(() => _validatingPhoto = true);
        final photoErr = await _photoValidationError(photoUrl);
        if (mounted) setState(() => _validatingPhoto = false);
        if (photoErr != null) {
          if (mounted) {
            setState(() {
              _photoError = photoErr;
              _loading = false;
            });
          }
          return;
        }
      }
      final phone = _contactPhone.text.trim();
      final body = {
        'description': _description.text.trim(),
        'preferredDate': _date.toUtc().toIso8601String(),
        if (phone.isNotEmpty) 'contactPhone': phone,
        // UpdatePickupRequestDto carries neither, so both go on create only.
        if (!_isEditing) 'zoneId': _zoneId,
        if (!_isEditing) 'isBulkRequest': _isBulkRequest,
        'address': _address.text.trim(),
        'latitude': _point?.latitude,
        'longitude': _point?.longitude,
        if (_isEditing) 'clearLocation': _point == null,
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

      final created =
          await _api.post('/pickuprequests', body: body)
              as Map<String, dynamic>;

      // Creating a pickup only stores it; nothing classifies it. The agents run
      // on this call, and it is what decides the category, whether the pickup
      // needs admin review, and which rule it broke -- EXCESSIVE_BULK_PICKUPS
      // when a bulky item lands on a spent allowance.
      //
      // Without it a request submitted here sat at Pending for ever: never
      // classified, never flagged, and never seen by an admin, while the same
      // request made on the web went through review. The web form has always
      // made this call; mobile never did.
      var pickup = created;
      String? pipelineError;
      try {
        setState(() => _classifying = true);
        final result = await _api.post(
          '/pickuprequests/${created['id']}/run-agent-pipeline',
        );
        final map = result is Map
            ? result.cast<String, dynamic>()
            : const <String, dynamic>{};
        final classified = map['pickup'];
        if (classified is Map) pickup = classified.cast<String, dynamic>();
        if (map['success'] != true) {
          pipelineError =
              map['message'] as String? ?? 'Classification did not complete.';
        }
      } catch (e) {
        // The pickup exists and Pending is a valid state an admin can push
        // through, so a failure here must not read as a failed submission.
        pipelineError = '$e';
      } finally {
        if (mounted) setState(() => _classifying = false);
      }

      widget.onSubmitted?.call();
      if (!mounted) return;
      if (pipelineError != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Request saved, but it could not be classified yet. '
              'An admin will pick it up. ($pipelineError)',
            ),
          ),
        );
      }
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => PickupSubmittedScreen(
            pickup: pickup,
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
      if (mounted) {
        setState(() {
          _loading = false;
          _validatingPhoto = false;
        });
      }
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
                  if (_photoError != null) _fieldError(_photoError!),
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
                    'Add a clear photo, tell us what you’re recycling, and choose a collection day.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.6,
                      color: EcoColors.body,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (!_isEditing) ...[
                    const EcoFieldLabel('Your zone'),
                    Container(
                      decoration: BoxDecoration(
                        color: EcoColors.surface,
                        border: Border.all(
                          color: EcoColors.green.withValues(alpha: 0.12),
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _zoneId,
                          isExpanded: true,
                          hint: Text(
                            _zones.isEmpty
                                ? 'Zones unavailable — try again'
                                : 'Select your zone…',
                            style: const TextStyle(
                              fontSize: 14,
                              color: EcoColors.muted,
                            ),
                          ),
                          items: _zones
                              .map(
                                (zone) => DropdownMenuItem<String>(
                                  value: zone['id'] as String?,
                                  child: Text(
                                    (zone['name'] as String?) ?? 'Unnamed zone',
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: EcoColors.ink,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) {
                            setState(() {
                              _zoneId = value;
                              _point = null;
                              _zoneError = null;
                            });
                            // The date already picked may not be a day this
                            // zone is collected on, so move it to the next one
                            // that is rather than leaving a date that would be
                            // refused on submit.
                            final next = _nextCollectionDay();
                            if (next != null && !_isCollectionDay(_date)) {
                              setState(() {
                                _date = next;
                                _dateLabel.text = DateFormat(
                                  'EEE, d MMM yyyy',
                                ).format(next);
                                _dateError = null;
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    if (_zoneError != null) _fieldError(_zoneError!),
                    // Which days that zone is actually collected. Shown as soon
                    // as a zone is chosen, because the date below cannot be
                    // honoured on any other day.
                    if (_collectionDaysLabel != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 6, left: 4),
                        child: Text(
                          _collectionDaysLabel!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: EcoColors.body,
                          ),
                        ),
                      ),
                  ],
                  const SizedBox(height: 20),
                  const EcoFieldLabel('Address'),
                  EcoTextField(
                    controller: _address,
                    onChanged: (_) => setState(() => _point = null),
                    hint: 'e.g. 14/2 Temple Road, near the junction',
                    prefixIcon: Icons.location_on_outlined,
                  ),
                  if (_addressError != null) _fieldError(_addressError!),
                  _fieldHint(
                    'A zone is a whole suburb, so the crew needs the '
                    'house number and street.',
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: _choosePoint,
                    icon: const Icon(Icons.location_on_outlined),
                    label: Text(
                      _point == null
                          ? 'Add pickup pin (optional)'
                          : 'Change pickup pin',
                    ),
                  ),
                  if (_point != null)
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${_point!.latitude.toStringAsFixed(5)}, ${_point!.longitude.toStringAsFixed(5)}',
                          ),
                        ),
                        IconButton(
                          tooltip: 'Remove pickup pin',
                          onPressed: () => setState(() => _point = null),
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                  const SizedBox(height: 16),
                  const EcoFieldLabel('Contact number'),
                  EcoTextField(
                    controller: _contactPhone,
                    keyboardType: TextInputType.phone,
                    hint: 'e.g. 0771234567',
                    prefixIcon: Icons.phone_outlined,
                    maxLength: 20,
                  ),
                  if (_contactPhoneError != null)
                    _fieldError(_contactPhoneError!),
                  _fieldHint(
                    'Whoever will be at the collection — it need not be you.',
                  ),
                  const SizedBox(height: 20),
                  EcoFieldLabel(
                    _collectionDays.isNotEmpty
                        ? 'Choose a collection day'
                        : 'Collect on or after',
                  ),
                  EcoTextField(
                    readOnly: true,
                    onTap: () async {
                      // Days the zone is not collected on are shown but greyed
                      // out, rather than the list being narrowed to the few that
                      // are. A resident reads the calendar they already know and
                      // can see at a glance which days their zone is served; a
                      // list of eight dates hides that shape entirely.
                      final initial = _isCollectionDay(_date)
                          ? _date
                          : _nextCollectionDay();
                      final from = initial ?? DateTime.now();
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                        initialDate: from.isBefore(DateTime.now())
                            ? DateTime.now()
                            : from,
                        selectableDayPredicate: _isCollectionDay,
                      );
                      if (picked != null) {
                        setState(() {
                          _date = picked;
                          _dateLabel.text = DateFormat(
                            'EEE, d MMM yyyy',
                          ).format(picked);
                          _dateError = null;
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
                  // The hours are the same every day and nothing books a stop
                  // for a time of its own, so this is the only promise that can
                  // be made about when the crew arrives.
                  _fieldHint(
                    'Collections run $_collectionWindowLabel. Please have it '
                    'out by the start of that window.',
                  ),
                  const SizedBox(height: 20),
                  const EcoFieldLabel('What needs collecting?'),
                  EcoTextField(
                    controller: _description,
                    hint: 'e.g. Clean bottles and flattened cardboard',
                    maxLines: 3,
                    // So the bulky nudge below appears as they type, rather
                    // than only after the field loses focus.
                    onChanged: (_) => setState(() {}),
                  ),
                  if (_descriptionError != null)
                    _fieldError(_descriptionError!),
                  // Bulky collections are booked separately and draw on a
                  // monthly allowance, so the resident declares it here rather
                  // than finding out after the classifier has run. Create only:
                  // the update endpoint does not accept the flag.
                  if (!_isEditing) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: EcoColors.mintLight,
                        border: Border.all(color: EcoColors.border),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Unticking is always allowed; only ticking a new one
                          // is blocked once the allowance is spent. Greyed when
                          // blocked, or the box reads as broken rather than as
                          // refused -- the allowance line below says why.
                          InkWell(
                            onTap: _bulkLocked
                                ? null
                                : () => setState(() {
                                    _isBulkRequest = !_isBulkRequest;
                                    _bulkError = null;
                                  }),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Checkbox(
                                  value: _isBulkRequest,
                                  visualDensity: VisualDensity.compact,
                                  onChanged: _bulkLocked
                                      ? null
                                      : (value) => setState(() {
                                          _isBulkRequest = value ?? false;
                                          _bulkError = null;
                                        }),
                                ),
                                Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.only(top: 10),
                                    child: Text(
                                      'This is a bulky-waste collection '
                                      '(furniture, mattress, large appliance)',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: _bulkLocked
                                            ? EcoColors.muted
                                            : EcoColors.ink,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_bulkError != null) _fieldError(_bulkError!),
                          if (_bulkAllowance != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4, left: 4),
                              child: Text(
                                (_bulkRemaining ?? 0) > 0
                                    ? '$_bulkRemaining of $_bulkLimit bulky collections left this month.'
                                    : 'You have used all $_bulkLimit bulky collections this '
                                          'month. The allowance resets on $_bulkResetLabel.',
                                style: const TextStyle(
                                  fontSize: 12.5,
                                  color: EcoColors.body,
                                ),
                              ),
                            ),
                          // Nudged, never forced: the resident can still say no,
                          // and the classifier remains the backstop after
                          // submission.
                          if (!_isBulkRequest && _looksBulky)
                            Padding(
                              padding: const EdgeInsets.only(top: 8, left: 4),
                              child: Text(
                                'This looks like a bulky item. Bulky collections are booked '
                                'separately and use your monthly allowance — tick the box '
                                'above if that is what you need.',
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: EcoColors.amber,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                  const EcoFieldLabel('How often?'),
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
                    const EcoFieldLabel('How often does it repeat?'),
                    Container(
                      decoration: BoxDecoration(
                        color: EcoColors.surface,
                        border: Border.all(
                          color: EcoColors.green.withValues(alpha: 0.12),
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _interval,
                          isExpanded: true,
                          hint: const Text(
                            'Select…',
                            style: TextStyle(
                              fontSize: 14,
                              color: EcoColors.muted,
                            ),
                          ),
                          // These two only. A free text box accepted anything
                          // and the server then refused everything else.
                          items: _allowedIntervals
                              .map(
                                (label) => DropdownMenuItem<String>(
                                  value: label,
                                  child: Text(
                                    label,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: EcoColors.ink,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) => setState(() {
                            _interval = value;
                            _intervalError = null;
                          }),
                        ),
                      ),
                    ),
                    if (_intervalError != null) _fieldError(_intervalError!),
                  ],
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_validatingPhoto)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: EcoColors.primary,
                          ),
                        ),
                        SizedBox(width: 10),
                        Text(
                          'Checking your photo looks like waste…',
                          style: TextStyle(
                            color: EcoColors.body,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                EcoPrimaryButton(
                  // Named while the agents run, as the web form does: the pickup
                  // is already saved by then, and a bare spinner reads as if the
                  // submission itself were still in doubt.
                  label: _classifying
                      ? 'Classifying your waste…'
                      : (_isEditing ? 'Save changes' : 'Submit request'),
                  loading: _loading,
                  onPressed: _submit,
                ),
              ],
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
