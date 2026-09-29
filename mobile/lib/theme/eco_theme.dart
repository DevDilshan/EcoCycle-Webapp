import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Matches web `public.css` / design tokens (landing, login, register).
abstract final class EcoColors {
  static const ivory = Color(0xFFFFFFF0);
  static const honeydew = Color(0xFFF0FFF0);
  static const celadon = Color(0xFFACE1AF);
  static const celadonStrong = Color(0xFF9CD8A0);
  static const green = Color(0xFF00563B);
  static const greenHover = Color(0xFF00452F);
  static const ink = Color(0xFF16241D);
  static const body = Color(0xFF4A5D53);
  static const label = Color(0xFF16241D);
  static const muted = Color(0xFF8A9A91);
  static const monoMuted = Color(0xFF7A8A80);
  static const border = Color(0x1A00563B);
  static const cardBorder = Color(0x1A00563B);
  static const surface = Color(0xFFFFFFFF);
  static const mintBg = Color(0x73ACE1AF);
  static const mintLight = honeydew;
  static const avatarBg = celadon;
  static const danger = Color(0xFF8A1C12);
  static const dangerBg = Color(0xFFFDECEA);
  static const amber = Color(0xFFB7791F);
  static const purple = Color(0xFF6D4BB0);
  static const blue = Color(0xFF2B6CB0);

  // Legacy aliases used across feature screens
  static const primary = green;
  static const primaryDark = greenHover;
  static const canvas = ivory;
}

TextTheme _textTheme() {
  final base = GoogleFonts.manropeTextTheme();
  return base.copyWith(
    headlineMedium: base.headlineMedium?.copyWith(
      fontWeight: FontWeight.w800,
      letterSpacing: -0.02 * 16,
      color: EcoColors.green,
    ),
    titleLarge: base.titleLarge?.copyWith(
      fontWeight: FontWeight.w800,
      fontSize: 20,
      color: EcoColors.green,
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
    scaffoldBackgroundColor: EcoColors.ivory,
    colorScheme: ColorScheme.fromSeed(
      seedColor: EcoColors.green,
      primary: EcoColors.green,
      surface: EcoColors.ivory,
    ),
    textTheme: _textTheme(),
    appBarTheme: AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: EcoColors.ivory,
      foregroundColor: EcoColors.green,
      titleTextStyle: GoogleFonts.manrope(
        fontWeight: FontWeight.w800,
        fontSize: 18,
        color: EcoColors.green,
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
