import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_components.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _email.text.trim(),
        password: _password.text,
      );
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
    return EcoScreen(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 48),
            const EcoLogo(),
            const SizedBox(height: 26),
            Text(
              'Welcome back',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 28),
            ),
            const SizedBox(height: 6),
            const Text(
              'Schedule smart waste pickups in seconds.',
              style: TextStyle(fontSize: 14, color: EcoColors.body),
            ),
            const SizedBox(height: 30),
            const EcoFieldLabel('Email'),
            EcoTextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
            ),
            const SizedBox(height: 16),
            const EcoFieldLabel('Password'),
            EcoTextField(controller: _password, obscure: true),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {},
                child: const Text(
                  'Forgot password?',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: EcoColors.primary,
                  ),
                ),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: EcoColors.danger, fontSize: 13)),
              ),
            EcoPrimaryButton(label: 'Log in', loading: _loading, onPressed: _signIn),
            const SizedBox(height: 20),
            Center(
              child: GestureDetector(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => const RegisterScreen()),
                ),
                child: RichText(
                  text: const TextSpan(
                    style: TextStyle(fontSize: 13, color: EcoColors.body),
                    children: [
                      TextSpan(text: 'New here? '),
                      TextSpan(
                        text: 'Create account',
                        style: TextStyle(
                          color: EcoColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
