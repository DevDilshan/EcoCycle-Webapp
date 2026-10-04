import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';

class EcoAuthHeading extends StatelessWidget {
  const EcoAuthHeading({
    super.key,
    required this.title,
    required this.subtitle,
  });
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text(
          title,
          style: const TextStyle(
            fontSize: 32,
            height: 1.17,
            letterSpacing: -1,
            fontWeight: FontWeight.w800,
            color: EcoColors.green,
          ),
        ),
      ),
      const SizedBox(height: 10),
      Text(
        subtitle,
        style: const TextStyle(
          fontSize: 14,
          height: 1.55,
          color: EcoColors.body,
        ),
      ),
      const SizedBox(height: 28),
    ],
  );
}

class EcoAuthField extends StatelessWidget {
  const EcoAuthField({
    super.key,
    required this.controller,
    required this.label,
    required this.hint,
    required this.icon,
    this.obscure = false,
    this.enabled = true,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.validator,
    this.onSubmitted,
    this.suffix,
    this.helper,
  });
  final TextEditingController controller;
  final String label;
  final String hint;
  final IconData icon;
  final bool obscure;
  final bool enabled;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffix;
  final String? helper;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: color, width: width),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: EcoColors.ink,
          ),
        ),
        const SizedBox(height: 8),
        Semantics(
          label: label,
          child: TextFormField(
            controller: controller,
            enabled: enabled,
            obscureText: obscure,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            autofillHints: autofillHints,
            validator: validator,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            onFieldSubmitted: onSubmitted,
            autocorrect: false,
            enableSuggestions: !obscure,
            style: const TextStyle(fontSize: 15, color: EcoColors.ink),
            decoration: InputDecoration(
              hintText: hint,
              filled: true,
              fillColor: EcoColors.surface,
              hintStyle: const TextStyle(fontSize: 14, color: EcoColors.body),
              prefixIcon: Icon(icon, size: 20, color: EcoColors.body),
              suffixIcon: suffix,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 18,
              ),
              enabledBorder: border(EcoColors.green.withValues(alpha: .14)),
              focusedBorder: border(EcoColors.green, 1.6),
              errorBorder: border(EcoColors.danger),
              focusedErrorBorder: border(EcoColors.danger, 1.6),
              disabledBorder: border(EcoColors.border),
              errorStyle: const TextStyle(
                fontSize: 12,
                height: 1.4,
                color: EcoColors.danger,
              ),
              errorMaxLines: 3,
              helperText: helper,
              helperMaxLines: 3,
              helperStyle: const TextStyle(
                fontSize: 12,
                height: 1.4,
                color: EcoColors.body,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class EcoAuthError extends StatelessWidget {
  const EcoAuthError(this.message, {super.key});
  final String? message;

  @override
  Widget build(BuildContext context) => message == null
      ? const SizedBox.shrink()
      : Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Semantics(
            liveRegion: true,
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: EcoColors.dangerBg,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                message!,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: EcoColors.danger,
                ),
              ),
            ),
          ),
        );
}

String? validateAuthEmail(String? value) {
  final email = value?.trim() ?? '';
  if (email.isEmpty) return 'Enter your email address.';
  final parts = email.split('@');
  if (parts.length != 2 ||
      parts[0].isEmpty ||
      !parts[1].contains('.') ||
      parts[1].startsWith('.') ||
      parts[1].endsWith('.') ||
      email.contains(' ')) {
    return 'Enter a valid email address.';
  }
  return null;
}

String? validateNewPassword(String? value) {
  if ((value ?? '').length < 6) return 'Use at least 6 characters.';
  return null;
}
