import 'package:shared_preferences/shared_preferences.dart';

abstract interface class OnboardingStore {
  Future<bool> isComplete();
  Future<void> complete();
}

/// A device preference, separate from the account/session. Signing out never
/// resets onboarding; clearing app data or reinstalling starts a fresh flow.
class DeviceOnboardingStore implements OnboardingStore {
  DeviceOnboardingStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const completedKey = 'ecocycle.onboarding.complete.v1';
  final SharedPreferencesAsync _preferences;

  @override
  Future<bool> isComplete() async =>
      await _preferences.getBool(completedKey) ?? false;

  @override
  Future<void> complete() => _preferences.setBool(completedKey, true);
}
