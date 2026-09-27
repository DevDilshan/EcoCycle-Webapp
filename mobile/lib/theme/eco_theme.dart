import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens from EcoCycle Mobile App.dc.html
abstract final class EcoColors {
  static const canvas = Color(0xFFF4F6F2);
  static const primary = Color(0xFF2F7D51);
  static const primaryDark = Color(0xFF256A44);
  static const ink = Color(0xFF17231C);
  static const body = Color(0xFF5F6F66);
  static const label = Color(0xFF3A4A40);
  static const muted = Color(0xFF9AA8A0);
  static const monoMuted = Color(0xFF7A8A80);
  static const border = Color(0xFFE0E8E0);
  static const cardBorder = Color(0xFFE5EBE5);
  static const mintBg = Color(0xFFEAF3EC);
  static const mintLight = Color(0xFFE4EFE6);
  static const avatarBg = Color(0xFFDFE9DF);
  static const danger = Color(0xFFC0392B);
  static const amber = Color(0xFFB7791F);
  static const purple = Color(0xFF6D4BB0);
  static const blue = Color(0xFF2B6CB0);
}

TextTheme _textTheme() {
  final base = GoogleFonts.plusJakartaSansTextTheme();
  return base.copyWith(
    headlineMedium: base.headlineMedium?.copyWith(
      fontWeight: FontWeight.w800,
      letterSpacing: -0.02 * 16,
      color: EcoColors.ink,
    ),
    titleLarge: base.titleLarge?.copyWith(
      fontWeight: FontWeight.w800,
      fontSize: 20,
      color: EcoColors.ink,
    ),
    titleMedium: base.titleMedium?.copyWith(
      fontWeight: FontWeight.w700,
      fontSize: 15,
      color: EcoColors.ink,
    ),
    bodyMedium: base.bodyMedium?.copyWith(
      fontSize: 14,
      color: EcoColors.ink,
    ),
    bodySmall: base.bodySmall?.copyWith(
      fontSize: 12,
      color: EcoColors.body,
    ),
    labelLarge: base.labelLarge?.copyWith(
      fontWeight: FontWeight.w700,
      fontSize: 15,
      color: Colors.white,
    ),
  );
}

ThemeData buildEcoTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: EcoColors.canvas,
    colorScheme: ColorScheme.fromSeed(
      seedColor: EcoColors.primary,
      primary: EcoColors.primary,
      surface: EcoColors.canvas,
    ),
    textTheme: _textTheme(),
    appBarTheme: AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: EcoColors.canvas,
      foregroundColor: EcoColors.ink,
      titleTextStyle: GoogleFonts.plusJakartaSans(
        fontWeight: FontWeight.w800,
        fontSize: 18,
        color: EcoColors.ink,
      ),
    ),
  );
}

TextStyle ecoMono({double size = 11, Color? color}) =>
    GoogleFonts.jetBrainsMono(
      fontSize: size,
      fontWeight: FontWeight.w500,
      color: color ?? EcoColors.monoMuted,
    );
