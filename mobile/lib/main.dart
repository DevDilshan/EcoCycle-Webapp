import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/auth_gate.dart';
import 'config/app_config.dart';
import 'theme/eco_theme.dart';

Future<void> main() async {
  await runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    await dotenv.load(fileName: '.env');
    AppConfig.assertConfigured();

    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      publishableKey: AppConfig.supabaseAnonKey,
    );

    runApp(const EcoCycleApp());
  }, (error, stack) {
    unawaited(handleUncaughtAuthNetworkError(error));
    if (kDebugMode) {
      FlutterError.dumpErrorToConsole(FlutterErrorDetails(exception: error, stack: stack));
    }
  });
}

class EcoCycleApp extends StatelessWidget {
  const EcoCycleApp({super.key});

  @override
  Widget build(BuildContext context) {
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
      home: const AuthGate(),
    );
  }
}
