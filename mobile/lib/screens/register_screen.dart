import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_components.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  bool _success = false;
  String? _error;
  String _role = 'resident';

  static const _roles = [
    ('resident', 'Resident', Icons.home_outlined),
    ('collector', 'Collector', Icons.local_shipping_outlined),
  ];

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signUp(
        email: _email.text.trim(),
        password: _password.text,
        data: {'role': _role},
      );
      if (mounted) setState(() => _success = true);
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = friendlyNetworkMessage(e));
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
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: EcoColors.celadon.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.mark_email_read_outlined, color: EcoColors.green),
            ),
            const SizedBox(height: 20),
            Text(
              'Check your email',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 26),
            ),
            const SizedBox(height: 8),
            Text.rich(
              TextSpan(
                style: const TextStyle(fontSize: 15, height: 1.45, color: EcoColors.body),
                children: [
                  const TextSpan(text: 'We sent a confirmation link to '),
                  TextSpan(
                    text: _email.text.trim(),
                    style: const TextStyle(fontWeight: FontWeight.w700, color: EcoColors.ink),
                  ),
                  const TextSpan(text: '. Open it to activate your account.'),
                ],
              ),
            ),
            const SizedBox(height: 24),
            EcoPrimaryButton(
              label: 'Back to log in',
              onPressed: () => Navigator.pop(context),
            ),
          ],
        ),
      );
    }

    return EcoAuthScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: EcoColors.celadon.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.person_add_outlined, color: EcoColors.green),
          ),
          const SizedBox(height: 20),
          Text(
            'Create your account',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 26),
          ),
          const SizedBox(height: 8),
          const Text(
            'Join EcoCycle to schedule pickups and earn rewards.',
            style: TextStyle(fontSize: 15, height: 1.45, color: EcoColors.body),
          ),
          const SizedBox(height: 24),
          const EcoFieldLabel('I am a'),
          Row(
            children: _roles.map((r) {
              final (value, label, icon) = r;
              final selected = _role == value;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: value == 'resident' ? 8 : 0),
                  child: Material(
                    color: selected ? EcoColors.green : EcoColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    child: InkWell(
                      onTap: () => setState(() => _role = value),
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: selected
                                ? EcoColors.green
                                : EcoColors.green.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Column(
                          children: [
                            Icon(icon, color: selected ? EcoColors.ivory : EcoColors.green, size: 22),
                            const SizedBox(height: 4),
                            Text(
                              label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: selected ? EcoColors.ivory : EcoColors.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          const EcoFieldLabel('Email'),
          EcoTextField(
            controller: _email,
            hint: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            prefixIcon: Icons.mail_outline_rounded,
          ),
          const SizedBox(height: 16),
          const EcoFieldLabel('Password'),
          EcoTextField(
            controller: _password,
            obscure: !_showPassword,
            prefixIcon: Icons.lock_outline_rounded,
            suffix: IconButton(
              onPressed: () => setState(() => _showPassword = !_showPassword),
              icon: Icon(
                _showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                color: EcoColors.body,
                size: 20,
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_error!, style: const TextStyle(color: EcoColors.danger, fontSize: 13)),
            ),
          const SizedBox(height: 24),
          EcoPrimaryButton(label: 'Create account', loading: _loading, onPressed: _register),
          const SizedBox(height: 16),
          Center(
            child: GestureDetector(
              onTap: () => Navigator.pop(context),
              child: RichText(
                text: const TextSpan(
                  style: TextStyle(fontSize: 14, color: EcoColors.body),
                  children: [
                    TextSpan(text: 'Already have an account? '),
                    TextSpan(
                      text: 'Log in',
                      style: TextStyle(color: EcoColors.green, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
