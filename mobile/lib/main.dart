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
      home: const AuthGate(),
    );
  }
}
