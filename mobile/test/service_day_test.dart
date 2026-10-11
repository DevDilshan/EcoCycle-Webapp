import 'package:ecocycle_mobile/services/service_day.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('the service day is Sri Lanka time, not the phone or UTC', () {
    // 20:00 UTC on 10 Oct is 01:30 on 11 Oct in Colombo.
    final now = DateTime.utc(2026, 10, 10, 20);
    expect(serviceToday(now), DateTime(2026, 10, 11));
    expect(serviceNow(now).hour, 1);
    expect(serviceNow(now).minute, 30);
  });

  test('today can be booked until noon in Colombo, then tomorrow', () {
    final beforeNoon = DateTime.utc(2026, 10, 11, 6, 29); // 11:59 in Colombo
    final atNoon = DateTime.utc(2026, 10, 11, 6, 30); // 12:00 in Colombo

    expect(sameDayOpen(beforeNoon), isTrue);
    expect(earliestBookingDay(beforeNoon), DateTime(2026, 10, 11));
    expect(sameDayOpen(atNoon), isFalse);
    expect(earliestBookingDay(atNoon), DateTime(2026, 10, 12));
  });

  test('the earliest day rolls over the end of a month', () {
    final lateOnTheLastDay = DateTime.utc(2026, 10, 31, 10); // 15:30 in Colombo
    expect(earliestBookingDay(lateOnTheLastDay), DateTime(2026, 11, 1));
  });
}
