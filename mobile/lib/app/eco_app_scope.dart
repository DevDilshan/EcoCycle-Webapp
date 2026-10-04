import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/api.dart';

/// Optional app dependencies for isolated previews and widget verification.
/// Without a scope every screen uses the real API and authenticated user.
class EcoAppScope extends InheritedWidget {
  const EcoAppScope({
    super.key,
    required this.api,
    required this.user,
    this.preview = false,
    required super.child,
  });
  final Api api;
  final User user;
  final bool preview;

  static EcoAppScope? of(BuildContext context) =>
      context.getInheritedWidgetOfExactType<EcoAppScope>();
  static Api apiOf(BuildContext context) => of(context)?.api ?? Api();
  static User? userOf(BuildContext context) =>
      of(context)?.user ?? Supabase.instance.client.auth.currentUser;
  static bool isPreview(BuildContext context) => of(context)?.preview ?? false;

  @override
  bool updateShouldNotify(EcoAppScope oldWidget) =>
      api != oldWidget.api ||
      user != oldWidget.user ||
      preview != oldWidget.preview;
}
