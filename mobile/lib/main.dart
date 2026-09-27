import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app/collector_shell.dart';
import 'app/resident_shell.dart';
import 'config/app_config.dart';
import 'screens/login_screen.dart';
import 'theme/eco_theme.dart';
import 'utils/user_helpers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  AppConfig.assertConfigured();

  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabaseAnonKey,
  );

  runApp(const EcoCycleApp());
}

class EcoCycleApp extends StatelessWidget {
  const EcoCycleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EcoCycle',
      debugShowCheckedModeBanner: false,
      theme: buildEcoTheme(),
      home: StreamBuilder<AuthState>(
        stream: Supabase.instance.client.auth.onAuthStateChange,
        builder: (context, snapshot) {
          final session = snapshot.data?.session;
          if (session == null) return const LoginScreen();
          final role = userRole(session.user);
          if (role == 'collector') return const CollectorShell();
          return const ResidentShell();
        },
      ),
    );
  }
}
