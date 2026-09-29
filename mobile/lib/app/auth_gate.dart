import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../screens/landing_screen.dart';
import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../utils/user_helpers.dart';
import 'collector_shell.dart';
import 'resident_shell.dart';

/// Routes by auth role and clears sessions that cannot refresh (wrong URL, no DNS).
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  StreamSubscription<AuthState>? _authSub;
  bool _checkingSession = true;

  @override
  void initState() {
    super.initState();
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(() {});
    });
    unawaited(_validateStoredSession());
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
    } finally {
      if (mounted) setState(() => _checkingSession = false);
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
      return const Scaffold(
        backgroundColor: EcoColors.ivory,
        body: Center(
          child: CircularProgressIndicator(color: EcoColors.green),
        ),
      );
    }

    final session = Supabase.instance.client.auth.currentSession;
    if (session == null) return const LandingScreen();

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
