import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/auth_redirect.dart';
import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_auth.dart';
import '../widgets/eco_components.dart';
import '../widgets/google_sign_in_button.dart';
import 'login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _oauthLoading = false;
  bool _showPassword = false;
  bool _success = false;
  String? _error;
  String _role = 'resident';
  bool get _busy => _loading || _oauthLoading;

  static const _roles = [
    ('resident', 'Resident', 'Arrange pickups', Icons.home_outlined),
    (
      'collector',
      'Collector',
      'Manage your route',
      Icons.local_shipping_outlined,
    ),
  ];

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _openLogin() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
      );
    }
  }

  Future<void> _register() async {
    if (_busy || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await Supabase.instance.client.auth.signUp(
        email: _email.text.trim(),
        password: _password.text,
        emailRedirectTo: authRedirectUrl,
        data: {'role': _role},
      );
      TextInput.finishAutofillContext();
      if (!mounted) return;
      if (result.session != null) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      } else {
        setState(() => _success = true);
      }
    } on AuthException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyNetworkMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_success) {
      return EcoAuthScaffold(
        child: Column(
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
              title: 'Check your email',
              subtitle: 'One last step to your greener routine.',
            ),
            Text.rich(
              TextSpan(
                style: const TextStyle(
                  fontSize: 15,
                  height: 1.6,
                  color: EcoColors.body,
                ),
                children: [
                  const TextSpan(
                    text: 'Open the confirmation link we sent to ',
                  ),
                  TextSpan(
                    text: _email.text.trim(),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: EcoColors.green,
                    ),
                  ),
                  const TextSpan(text: ' to activate your account.'),
                ],
              ),
            ),
            const SizedBox(height: 28),
            EcoPrimaryButton(label: 'Back to log in', onPressed: _openLogin),
          ],
        ),
      );
    }
    return EcoAuthScaffold(
      child: AutofillGroup(
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const EcoAuthHeading(
                title: 'Create account',
                subtitle: 'A cleaner community starts with you.',
              ),
              const Text(
                'How will you use EcoCycle?',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: EcoColors.ink,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: _roles.map((role) {
                  final (value, label, description, icon) = role;
                  final selected = _role == value;
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        right: value == 'resident' ? 10 : 0,
                      ),
                      child: Semantics(
                        button: true,
                        selected: selected,
                        enabled: !_busy,
                        label: '$label. $description',
                        onTap: _busy
                            ? null
                            : () => setState(() => _role = value),
                        child: ExcludeSemantics(
                          child: Material(
                            color: selected
                                ? EcoColors.honeydew
                                : EcoColors.surface,
                            borderRadius: BorderRadius.circular(16),
                            child: InkWell(
                              onTap: _busy
                                  ? null
                                  : () => setState(() => _role = value),
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: selected
                                        ? EcoColors.green
                                        : EcoColors.border,
                                    width: selected ? 1.5 : 1,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          icon,
                                          color: EcoColors.green,
                                          size: 24,
                                        ),
                                        const Spacer(),
                                        Icon(
                                          selected
                                              ? Icons.check_circle_rounded
                                              : Icons.circle_outlined,
                                          size: 18,
                                          color: selected
                                              ? EcoColors.green
                                              : EcoColors.body,
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      label,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: EcoColors.green,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      description,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        height: 1.4,
                                        color: EcoColors.body,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              EcoAuthField(
                controller: _email,
                label: 'Email address',
                hint: 'you@example.com',
                icon: Icons.mail_outline_rounded,
                enabled: !_busy,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                autofillHints: const [
                  AutofillHints.email,
                  AutofillHints.username,
                ],
                validator: validateAuthEmail,
              ),
              const SizedBox(height: 20),
              EcoAuthField(
                controller: _password,
                label: 'Password',
                hint: 'Create a password',
                helper: 'Use at least 6 characters.',
                icon: Icons.lock_outline_rounded,
                enabled: !_busy,
                obscure: !_showPassword,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _register(),
                autofillHints: const [AutofillHints.newPassword],
                validator: validateNewPassword,
                suffix: IconButton(
                  tooltip: _showPassword ? 'Hide password' : 'Show password',
                  onPressed: _busy
                      ? null
                      : () => setState(() => _showPassword = !_showPassword),
                  icon: Icon(
                    _showPassword
                        ? Icons.visibility_off_outlined
                        : Icons.visibility_outlined,
                    color: EcoColors.body,
                    size: 21,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              EcoAuthError(_error),
              EcoPrimaryButton(
                label: 'Create account',
                icon: Icons.arrow_forward_rounded,
                loading: _loading,
                onPressed: _busy ? null : _register,
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
              if (_role == 'collector') ...[
                const SizedBox(height: 10),
                const Text(
                  'Google sign-up creates a resident account. Use email to join as a collector.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.5,
                    color: EcoColors.body,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              TextButton(
                onPressed: _busy ? null : _openLogin,
                child: const Text.rich(
                  TextSpan(
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: EcoColors.body,
                    ),
                    children: [
                      TextSpan(text: 'Already have an account? '),
                      TextSpan(
                        text: 'Log in',
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
}
