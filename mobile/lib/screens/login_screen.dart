import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_auth.dart';
import '../widgets/eco_components.dart';
import '../widgets/google_sign_in_button.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _oauthLoading = false;
  bool _showPassword = false;
  String? _error;
  bool get _busy => _loading || _oauthLoading;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (_busy || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
      TextInput.finishAutofillContext();
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
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
    child: AutofillGroup(
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const EcoAuthHeading(
              title: 'Welcome back',
              subtitle: 'Your pickups, rewards and greener routine await.',
            ),
            EcoAuthField(
              controller: _email,
              label: 'Email address',
              hint: 'you@example.com',
              icon: Icons.mail_outline_rounded,
              enabled: !_busy,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [
                AutofillHints.username,
                AutofillHints.email,
              ],
              validator: validateAuthEmail,
            ),
            const SizedBox(height: 20),
            EcoAuthField(
              controller: _password,
              label: 'Password',
              hint: 'Enter your password',
              icon: Icons.lock_outline_rounded,
              enabled: !_busy,
              obscure: !_showPassword,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              validator: (value) =>
                  (value ?? '').isEmpty ? 'Enter your password.' : null,
              onSubmitted: (_) => _signIn(),
              suffix: IconButton(
                tooltip: _showPassword ? 'Hide password' : 'Show password',
                onPressed: _busy
                    ? null
                    : () => setState(() => _showPassword = !_showPassword),
                icon: Icon(
                  _showPassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: EcoColors.green,
                  size: 21,
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _busy
                    ? null
                    : () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ForgotPasswordScreen(
                            initialEmail: _email.text.trim(),
                          ),
                        ),
                      ),
                child: const Text('Forgot password?'),
              ),
            ),
            const SizedBox(height: 8),
            EcoAuthError(_error),
            EcoPrimaryButton(
              label: 'Log in',
              loading: _loading,
              icon: Icons.arrow_forward_rounded,
              onPressed: _busy ? null : _signIn,
            ),
            const SizedBox(height: 24),
            GoogleSignInButton(
              enabled: !_loading,
              onBusyChanged: (value) {
                if (mounted) setState(() => _oauthLoading = value);
              },
              onError: (message) {
                if (mounted) setState(() => _error = message);
              },
            ),
            const SizedBox(height: 24),
            TextButton(
              onPressed: _busy
                  ? null
                  : () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const RegisterScreen(),
                      ),
                    ),
              child: const Text.rich(
                TextSpan(
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: EcoColors.body,
                  ),
                  children: [
                    TextSpan(text: 'New to EcoCycle? '),
                    TextSpan(
                      text: 'Create account',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: EcoColors.green,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
