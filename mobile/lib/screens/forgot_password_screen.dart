import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/auth_redirect.dart';
import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_auth.dart';
import '../widgets/eco_components.dart';
import 'login_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({
    super.key,
    this.initialEmail = '',
    this.sendResetLink,
  });
  final String initialEmail;
  final Future<void> Function(String email)? sendResetLink;
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _email;
  bool _loading = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  void _backToLogin() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      );
    }
  }

  Future<void> _send() async {
    if (_loading || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final email = _email.text.trim();
      if (widget.sendResetLink != null) {
        await widget.sendResetLink!(email);
      } else {
        await Supabase.instance.client.auth.resetPasswordForEmail(
          email,
          redirectTo: authRedirectUrl,
        );
      }
      if (mounted) setState(() => _sent = true);
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyNetworkMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => EcoAuthScaffold(
    onBack: _loading ? null : _backToLogin,
    child: _sent
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: EcoIconTile(
                  icon: Icons.mark_email_read_outlined,
                  size: 72,
                ),
              ),
              const SizedBox(height: 28),
              const EcoAuthHeading(
                title: 'Check your inbox',
                subtitle: 'Your next step is in your email.',
              ),
              Text.rich(
                TextSpan(
                  style: const TextStyle(
                    fontSize: 15,
                    height: 1.6,
                    color: EcoColors.body,
                  ),
                  children: [
                    const TextSpan(text: 'If an account exists for '),
                    TextSpan(
                      text: _email.text.trim(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: EcoColors.green,
                      ),
                    ),
                    const TextSpan(
                      text:
                          ', you’ll receive a password reset link. Check your spam folder too.',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              EcoPrimaryButton(
                label: 'Back to log in',
                onPressed: _backToLogin,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => setState(() {
                  _sent = false;
                  _error = null;
                }),
                child: const Text('Use a different email'),
              ),
            ],
          )
        : AutofillGroup(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const EcoAuthHeading(
                    title: 'Reset password',
                    subtitle:
                        'Enter your email and we’ll send a link to choose a new password.',
                  ),
                  EcoAuthField(
                    controller: _email,
                    label: 'Email address',
                    hint: 'you@example.com',
                    icon: Icons.mail_outline_rounded,
                    enabled: !_loading,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    autofillHints: const [AutofillHints.email],
                    validator: validateAuthEmail,
                    onSubmitted: (_) => _send(),
                  ),
                  const SizedBox(height: 28),
                  EcoAuthError(_error),
                  EcoPrimaryButton(
                    label: 'Send reset link',
                    icon: Icons.arrow_forward_rounded,
                    loading: _loading,
                    onPressed: _send,
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                    onPressed: _loading ? null : _backToLogin,
                    child: const Text(
                      'Remember your password? Log in',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
  );
}
