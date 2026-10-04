import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/auth_gate.dart';
import 'app/eco_startup.dart';
import 'config/app_config.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'theme/eco_theme.dart';
import 'widgets/eco_loading.dart';

Future<void> main() async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      runApp(EcoCycleApp(initialize: _initializeServices));
    },
    (error, stack) {
      unawaited(handleUncaughtAuthNetworkError(error));
      if (kDebugMode) {
        FlutterError.dumpErrorToConsole(
          FlutterErrorDetails(exception: error, stack: stack),
        );
      }
    },
  );
}

Future<void> _initializeServices() async {
  await dotenv.load(fileName: '.env');
  AppConfig.assertConfigured();
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );
}

class EcoCycleApp extends StatelessWidget {
  const EcoCycleApp({super.key, this.initialize});

  final Future<void> Function()? initialize;

  @override
  Widget build(BuildContext context) {
    final preview = kDebugMode && kIsWeb
        ? Uri.base.queryParameters['preview']
        : null;
    final Widget home = switch (preview) {
      'login' => const LoginScreen(),
      'register' => const RegisterScreen(),
      'forgot-password' => const ForgotPasswordScreen(),
      _ => const AuthGate(),
    };
    return MaterialApp(
      title: 'EcoCycle',
      debugShowCheckedModeBanner: false,
      theme: buildEcoTheme(),
      // On a phone this changes nothing. On a tablet or a browser window the
      // app stays phone-width and centred instead of stretching edge to edge.
      builder: (context, child) => ColoredBox(
        color: EcoColors.canvas,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: child,
          ),
        ),
      ),
      // Debug-only URL for checking the otherwise transient startup screen.
      home: preview == 'loading'
          ? const EcoLoadingScreen()
          : initialize != null
          ? EcoStartup(initialize: initialize!, child: home)
          : home,
    );
  }
}
