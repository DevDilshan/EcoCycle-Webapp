import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../screens/onboarding_screen.dart';
import '../screens/login_screen.dart';
import '../screens/register_screen.dart';
import '../screens/reset_password_screen.dart';
import '../services/onboarding_store.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import '../widgets/eco_loading.dart';
import '../utils/network_errors.dart';
import '../utils/user_helpers.dart';
import 'collector_shell.dart';
import 'resident_shell.dart';

/// Routes by auth role and clears sessions that cannot refresh (wrong URL, no DNS).
class AuthGate extends StatefulWidget {
  const AuthGate({super.key, this.onboardingStore});

  final OnboardingStore? onboardingStore;

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  StreamSubscription<AuthState>? _authSub;
  bool _checkingSession = true;
  bool _onboardingComplete = false;
  bool _startupFailed = false;
  bool _passwordRecovery = false;
  late final OnboardingStore _onboardingStore;

  @override
  void initState() {
    super.initState();
    _onboardingStore = widget.onboardingStore ?? DeviceOnboardingStore();
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen(
      (state) {
        if (!mounted) return;
        setState(() {
          if (state.event == AuthChangeEvent.passwordRecovery) {
            _passwordRecovery = true;
          }
          if (state.event == AuthChangeEvent.signedOut) {
            _passwordRecovery = false;
          }
        });
        if (state.event == AuthChangeEvent.passwordRecovery) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              Navigator.of(context).popUntil((route) => route.isFirst);
            }
          });
        }
      },
      onError: (Object error, StackTrace stack) {
        unawaited(handleUncaughtAuthNetworkError(error));
      },
    );
    unawaited(_initialize());
  }

  Future<void> _initialize() async {
    setState(() {
      _checkingSession = true;
      _startupFailed = false;
    });
    try {
      _onboardingComplete = await _onboardingStore.isComplete();
      await _validateStoredSession();
      // An existing signed-in installation already knows the app. Signing out
      // should open login, without making this user go through onboarding.
      if (Supabase.instance.client.auth.currentSession != null &&
          !_onboardingComplete) {
        await _onboardingStore.complete();
        _onboardingComplete = true;
      }
    } catch (_) {
      _startupFailed = true;
    } finally {
      if (mounted) setState(() => _checkingSession = false);
    }
  }

  Future<void> _completeOnboarding(bool createAccount) async {
    await _onboardingStore.complete();
    if (!mounted) return;
    setState(() => _onboardingComplete = true);
    if (createAccount) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const RegisterScreen()),
          );
        }
      });
    }
  }

  Future<void> _validateStoredSession() async {
    try {
      final session = Supabase.instance.client.auth.currentSession;
      if (session != null) {
        await Supabase.instance.client.auth.refreshSession();
      }
    } catch (e) {
      if (isRecoverableAuthNetworkError(e)) {
        await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
      }
    }
  }

  @override
  void dispose() {
    unawaited(_authSub?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingSession) {
      return const EcoLoadingScreen();
    }

    if (_startupFailed) {
      return Scaffold(
        backgroundColor: EcoColors.ivory,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const EcoBrand(),
                  const SizedBox(height: 24),
                  const Text(
                    'Could not open EcoCycle. Please try again.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  EcoPrimaryButton(label: 'Try again', onPressed: _initialize),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final session = Supabase.instance.client.auth.currentSession;
    if (_passwordRecovery && session != null) {
      return ResetPasswordScreen(
        onComplete: () => setState(() => _passwordRecovery = false),
      );
    }
    if (session == null) {
      return _onboardingComplete
          ? const LoginScreen()
          : OnboardingScreen(onComplete: _completeOnboarding);
    }

    final role = userRole(session.user);
    if (role == 'collector') return const CollectorShell();
    return const ResidentShell();
  }
}

/// Call from [runZonedGuarded] so background token refresh does not crash the app.
Future<void> handleUncaughtAuthNetworkError(Object error) async {
  if (!isRecoverableAuthNetworkError(error)) return;
  try {
    await Supabase.instance.client.auth.signOut(scope: SignOutScope.local);
  } catch (_) {}
}
