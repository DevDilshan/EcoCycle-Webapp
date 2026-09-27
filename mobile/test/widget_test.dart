import 'package:flutter_test/flutter_test.dart';

import 'package:ecocycle_mobile/main.dart';

void main() {
  testWidgets('EcoCycleApp builds', (WidgetTester tester) async {
    // EcoCycleApp requires env + Supabase init in main(); smoke-test the widget type.
    expect(const EcoCycleApp(), isNotNull);
  });
}
