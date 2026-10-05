import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme/eco_theme.dart';
import '../utils/network_errors.dart';
import '../widgets/eco_auth.dart';
import '../widgets/eco_components.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({
    super.key,
    required this.onComplete,
    this.updatePassword,
  });
  final VoidCallback onComplete;
  final Future<void> Function(String password)? updatePassword;
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  bool _updated = false;
  String? _error;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_loading || !_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      if (widget.updatePassword != null) {
        await widget.updatePassword!(_password.text);
      } else {
        await Supabase.instance.client.auth.updateUser(
          UserAttributes(password: _password.text),
        );
      }
      TextInput.finishAutofillContext();
      if (mounted) setState(() => _updated = true);
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
    child: _updated
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: EcoIconTile(icon: Icons.check_rounded, size: 72),
              ),
              const SizedBox(height: 28),
              const EcoAuthHeading(
                title: 'Password updated',
                subtitle: 'You’re ready for your next greener step.',
              ),
              EcoPrimaryButton(
                label: 'Continue',
                icon: Icons.arrow_forward_rounded,
                onPressed: widget.onComplete,
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
                    title: 'Choose a new password',
                    subtitle: 'Make it something only you know.',
                  ),
                  EcoAuthField(
                    controller: _password,
                    label: 'New password',
                    hint: 'Create a password',
                    helper: 'Use at least 6 characters.',
                    icon: Icons.lock_outline_rounded,
                    enabled: !_loading,
                    obscure: !_showPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    textInputAction: TextInputAction.next,
                    validator: validateNewPassword,
                    suffix: IconButton(
                      tooltip: _showPassword
                          ? 'Hide password'
                          : 'Show password',
                      onPressed: _loading
                          ? null
                          : () =>
                                setState(() => _showPassword = !_showPassword),
                      icon: Icon(
                        _showPassword
                            ? Icons.visibility_off_outlined
                            : Icons.visibility_outlined,
                        color: EcoColors.green,
                        size: 21,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  EcoAuthField(
                    controller: _confirm,
                    label: 'Confirm password',
                    hint: 'Enter it again',
                    icon: Icons.lock_outline_rounded,
                    enabled: !_loading,
                    obscure: !_showPassword,
                    autofillHints: const [AutofillHints.newPassword],
                    textInputAction: TextInputAction.done,
                    validator: (value) => value != _password.text
                        ? 'The passwords don’t match.'
                        : validateNewPassword(value),
                    onSubmitted: (_) => _save(),
                  ),
                  const SizedBox(height: 28),
                  EcoAuthError(_error),
                  EcoPrimaryButton(
                    label: 'Save password',
                    loading: _loading,
                    onPressed: _save,
                  ),
                ],
              ),
            ),
          ),
  );
}
