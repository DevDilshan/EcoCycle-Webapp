import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/api.dart';

/// Sample data is used only by the explicitly selected debug preview in main.
/// It never sets a Supabase session and refuses all writes.
class MobilePreviewApi extends Api {
  MobilePreviewApi() : super() {
    assert(kDebugMode);
  }
  static const residentId = 'preview-resident';
  // Illustrative service outline for read-only map review, not a city border.
  static const demoZones = <Map<String, dynamic>>[
    {
      'id': 'preview-zone',
      'name': 'Demo collection area',
      'isActive': true,
      'latitude': 6.917,
      'longitude': 79.875,
      'boundaryGeoJson':
          '{"type":"Polygon","coordinates":[[[79.858,6.902],[79.888,6.902],[79.888,6.935],[79.858,6.935],[79.858,6.902]]]}',
    },
  ];
  static User user({bool collector = false}) => User(
    id: collector ? 'preview-collector' : residentId,
    appMetadata: const {},
    userMetadata: {
      'full_name': collector ? 'Nimal' : 'Kavisha',
      'role': collector ? 'collector' : 'resident',
    },
    aud: 'authenticated',
    email: collector ? 'collector@example.com' : 'resident@example.com',
    createdAt: '2026-01-01T00:00:00Z',
  );
  final pickups = <Map<String, dynamic>>[
    {
      'id': 'preview-pickup-1',
      'zoneId': 'preview-zone',
      'address': '12 Park Road, Colombo 07',
      'latitude': 6.9108,
      'longitude': 79.8696,
      'description': 'Bottles & cardboard',
      'category': 'Recyclable',
      'status': 'Scheduled',
      'preferredDate': DateTime.now()
          .add(const Duration(days: 2))
          .toIso8601String(),
      'isRecurring': true,
      'recurrenceInterval': 'Weekly',
      'zoneName': 'Colombo',
      'confidence': .96,
      'hasApprovalRequest': false,
    },
    {
      'id': 'preview-pickup-2',
      'zoneId': 'preview-zone',
      'address': '4 Lake Drive, Colombo 08',
      'latitude': 6.9174,
      'longitude': 79.8812,
      'description': 'Garden clippings',
      'category': 'Organic',
      'status': 'Pending',
      'preferredDate': DateTime.now()
          .add(const Duration(days: 4))
          .toIso8601String(),
      'hasApprovalRequest': true,
      'approvalStatus': 'Pending',
      'flagReason': 'Your request is being reviewed.',
    },
    {
      'id': 'preview-pickup-3',
      'zoneId': 'preview-zone',
      'address': '31 Station Road, Colombo 04',
      'description': 'Paper & packaging',
      'category': 'Recyclable',
      'status': 'Completed',
      'preferredDate': DateTime.now()
          .subtract(const Duration(days: 3))
          .toIso8601String(),
      'hasApprovalRequest': false,
    },
  ];
  @override
  Future<dynamic> get(String path, {Map<String, String>? query}) async {
    if (path == '/pickuprequests/bulk-allowance') {
      return {'limit': 2, 'used': 0, 'remaining': 2};
    }
    if (path == '/zones/selectable') {
      return demoZones;
    }
    if (path == '/pickuprequests') return {'items': pickups};
    if (path.startsWith('/pickuprequests/')) {
      return pickups.firstWhere(
        (p) => path.endsWith(p['id'] as String),
        orElse: () => pickups.first,
      );
    }
    if (path == '/rewards/leaderboard') {
      return [
        {
          'residentId': 'preview-other',
          'residentName': 'Amali',
          'pointsEarned': 1640,
          'rank': 1,
        },
        {
          'residentId': residentId,
          'residentName': 'Kavisha',
          'pointsEarned': 1240,
          'rank': 2,
        },
        {
          'residentId': 'preview-other-2',
          'residentName': 'Dilan',
          'pointsEarned': 960,
          'rank': 3,
        },
      ];
    }
    if (path.startsWith('/rewards/') && path.endsWith('/history')) {
      return {
        'currentBalance': 1240,
        'items': List.generate(
          7,
          (i) => {
            'reason': i == 2
                ? 'Reusable tote reward'
                : 'Recycling pickup completed',
            'pointsEarned': i == 2 ? -150 : 120 + i * 10,
            'createdAt': DateTime.now()
                .subtract(Duration(days: i + 1))
                .toIso8601String(),
          },
        ),
      };
    }
    if (path == '/reward-items') {
      return {
        'items': [
          {
            'id': 'preview-reward-1',
            'name': 'Reusable tote bag',
            'description': 'A practical companion for your next shop.',
            'pointsCost': 250,
            'stock': 12,
            'imageUrl': '/images/rewards/tote.webp',
            'delivery': 'Collect',
          },
          {
            'id': 'preview-reward-2',
            'name': 'Stainless steel bottle',
            'description': 'Refill, reuse and keep going.',
            'pointsCost': 800,
            'stock': 4,
            'imageUrl': '/images/rewards/water-bottle.webp',
            'delivery': 'Collect',
          },
          {
            'id': 'preview-reward-seeds',
            'name': 'Herb seed packet',
            'description':
                'Basil, coriander and chilli seeds for your kitchen garden.',
            'pointsCost': 100,
            'stock': 20,
            'imageUrl': '/images/rewards/herb-seeds.webp',
            'delivery': 'Post',
            'deliveryInstructions':
                'Sent to the postal address you provide after approval.',
          },
          {
            'id': 'preview-reward-voucher',
            'name': 'Supermarket e-voucher',
            'description': 'A little help with your next grocery shop.',
            'pointsCost': 500,
            'stock': 50,
            'imageUrl': '/images/rewards/grocery-voucher.webp',
            'delivery': 'Email',
          },
          {
            'id': 'preview-reward-solar',
            'name': 'Solar garden light kit',
            'description': 'Four solar-powered lights for a brighter garden.',
            'pointsCost': 1500,
            'stock': 6,
            'imageUrl': '/images/rewards/solar-lights.webp',
            'delivery': 'Post',
          },
          {
            'id': 'preview-reward-compost',
            'name': 'Compost starter kit',
            'description':
                'Start turning kitchen scraps into something useful.',
            'pointsCost': 300,
            'stock': 0,
            'imageUrl': '/images/rewards/compost-kit.webp',
            'delivery': 'Collect',
          },
        ],
      };
    }
    if (path == '/redemptions') {
      return {
        'items': [
          {
            'id': 'preview-redemption',
            'rewardItemId': 'preview-reward-1',
            'reason': 'Reusable tote bag',
            'points': 250,
            'status': 'Pending',
            'createdAt': DateTime.now().toIso8601String(),
          },
          {
            'id': 'preview-redemption-collect',
            'reason': 'Grocery voucher',
            'points': 120,
            'status': 'Approved',
            'delivery': 'Collect',
            'collectionCode': 'ECO-7F3K-92QD',
            'deliveryInstructions':
                'Show this code at Counter 3, Town Hall, weekdays 9 am to 4 pm.',
            'createdAt': DateTime.now().toIso8601String(),
          },
          {
            'id': 'preview-redemption-post',
            'reason': 'Seed starter kit',
            'points': 90,
            'status': 'Approved',
            'delivery': 'Post',
            'collectionCode': 'ECO-B6NZ-P4GC',
            'deliveryAddress': '12 Galle Road, Colombo 03',
            'deliveryInstructions':
                'We will post this reward to the address you gave within 7 working days.',
            'createdAt': DateTime.now().toIso8601String(),
          },
        ],
      };
    }
    if (path == '/complaints') {
      return {
        'items': [
          {
            'id': 'preview-complaint',
            'issueType': 'Missed pickup',
            'description': 'Following up on my scheduled pickup.',
            'status': 'InReview',
            'createdAt': DateTime.now()
                .subtract(const Duration(days: 2))
                .toIso8601String(),
          },
        ],
      };
    }
    if (path.startsWith('/routes/')) {
      // Assigned stops carry their own detail and retain the route id.
      return List.generate(
        3,
        (i) => {
          ...pickups[i],
          'id': 'preview-route-${i + 1}',
          'pickupRequestId': pickups[i]['id'],
          'pickup': pickups[i],
          'completionStatus': i == 0 ? 1 : 0,
          'scheduledDate': DateTime.now()
              .add(Duration(days: path.contains('/upcoming') ? i + 1 : 0))
              .toIso8601String(),
        },
      );
    }
    throw Exception('This page has no sample data yet.');
  }

  Never _readOnly() => throw Exception(
    'Design preview is read-only. Log in to the app to make changes.',
  );
  @override
  Future<dynamic> post(String path, {Object? body}) async => _readOnly();
  @override
  Future<dynamic> put(String path, {Object? body}) async => _readOnly();
  @override
  Future<dynamic> patch(String path, {Object? body}) async => _readOnly();
  @override
  Future<dynamic> delete(String path) async => _readOnly();
}
