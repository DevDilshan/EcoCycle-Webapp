import 'package:flutter/foundation.dart';

/// Already registered by Android/iOS and used for OAuth and email callbacks.
const mobileAuthRedirectUrl = 'ecocycle://login-callback';
String get authRedirectUrl => kIsWeb ? Uri.base.origin : mobileAuthRedirectUrl;
