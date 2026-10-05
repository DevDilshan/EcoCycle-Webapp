import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/eco_theme.dart';
import '../services/auth_redirect.dart';
import '../utils/network_errors.dart';

/// Where Google sends the user back to on a phone. The scheme is registered in
/// AndroidManifest.xml and Info.plist, and the full URL has to be listed under
/// Redirect URLs in Supabase.
const googleRedirectUrl = mobileAuthRedirectUrl;

/// The "or" divider and the Google button, shared by the login and register
/// screens. [onError] receives null when a new attempt starts and the message
/// if the sign-in could not be started.
class GoogleSignInButton extends StatefulWidget {
  const GoogleSignInButton({
    super.key,
    required this.onError,
    this.enabled = true,
    this.onBusyChanged,
  });

  final ValueChanged<String?> onError;
  final bool enabled;
  final ValueChanged<bool>? onBusyChanged;

  @override
  State<GoogleSignInButton> createState() => _GoogleSignInButtonState();
}

class _GoogleSignInButtonState extends State<GoogleSignInButton> {
  StreamSubscription<AuthState>? _authSub;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    // The session arrives later, when the browser hands control back to the
    // app. AuthGate swaps the home screen then, but this screen was pushed on
    // top of it, so it has to get out of the way itself.
    _authSub = Supabase.instance.client.auth.onAuthStateChange.listen(
      (state) {
        if (state.event != AuthChangeEvent.signedIn || !mounted) return;
        Navigator.of(context).popUntil((route) => route.isFirst);
      },
      onError: (Object error, StackTrace stack) {
        if (mounted) widget.onError(friendlyNetworkMessage(error));
      },
    );
  }

  @override
  void dispose() {
    unawaited(_authSub?.cancel());
    super.dispose();
  }

  Future<void> _signIn() async {
    if (_loading) return;

    widget.onError(null);
    widget.onBusyChanged?.call(true);
    setState(() => _loading = true);
    try {
      final launched = await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: authRedirectUrl,
        authScreenLaunchMode: kIsWeb
            ? LaunchMode.platformDefault
            : LaunchMode.externalApplication,
      );
      if (!launched) widget.onError('Could not open Google sign-in.');
    } on AuthException catch (e) {
      widget.onError(e.message);
    } catch (e) {
      widget.onError(friendlyNetworkMessage(e));
    } finally {
      if (mounted) {
        widget.onBusyChanged?.call(false);
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Row(
          children: [
            Expanded(child: Divider(color: EcoColors.border, height: 1)),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'or',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: EcoColors.body,
                ),
              ),
            ),
            Expanded(child: Divider(color: EcoColors.border, height: 1)),
          ],
        ),
        const SizedBox(height: 16),
        Material(
          color: EcoColors.surface,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            onTap: _loading || !widget.enabled ? null : _signIn,
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: EcoColors.green.withValues(alpha: 0.2),
                ),
              ),
              alignment: Alignment.center,
              child: _loading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: EcoColors.green,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Image.asset(
                          'assets/images/google-g.png',
                          width: 18,
                          height: 18,
                          filterQuality: FilterQuality.medium,
                        ),
                        const SizedBox(width: 10),
                        const Flexible(
                          child: Text(
                            'Continue with Google',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: EcoColors.ink,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
