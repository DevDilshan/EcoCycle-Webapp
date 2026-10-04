import 'package:flutter/material.dart';

import '../../app/eco_app_scope.dart';
import '../../services/api.dart';
import '../../theme/eco_theme.dart';
import '../../widgets/eco_components.dart';
import '../../widgets/eco_feature.dart';
import '../../widgets/eco_loading.dart';
import '../pickup_detail_screen.dart';

class RequestsTab extends StatefulWidget {
  const RequestsTab({super.key, required this.onRequestPickup});
  final VoidCallback onRequestPickup;
  @override
  State<RequestsTab> createState() => RequestsTabState();
}

class RequestsTabState extends State<RequestsTab> {
  late final Api _api;
  int _filter = 0;
  bool _loading = true;
  bool _failed = false;
  List<Map<String, dynamic>> _items = [];
  @override
  void initState() {
    super.initState();
    _api = EcoAppScope.apiOf(context);
    reload();
  }

  Future<void> reload() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final json = await _api.get('/pickuprequests', query: {'pageSize': '50'});
      if (!mounted) return;
      setState(
        () => _items =
            (json['items'] as List?)?.cast<Map<String, dynamic>>() ?? [],
      );
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered => switch (_filter) {
    1 => _items.where(activePickup).toList(),
    2 =>
      _items
          .where(
            (p) => (p['status'] as String? ?? '').toLowerCase() == 'completed',
          )
          .toList(),
    _ => _items,
  };
  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: reload,
    color: EcoColors.green,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      // The page scrolls underneath the floating bar; this is the room
      // that lets the last item come to rest above it.
      padding: EdgeInsets.only(bottom: ecoNavClearance(context)),
      children: [
        EcoPageHeading(
          title: 'Your pickups',
          subtitle: 'Every request, from start to finish.',
          trailing: IconButton.filled(
            tooltip: 'Request a pickup',
            onPressed: widget.onRequestPickup,
            style: IconButton.styleFrom(
              backgroundColor: EcoColors.green,
              minimumSize: const Size(48, 48),
            ),
            icon: const Icon(Icons.add_rounded, color: Colors.white),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: FilterPills(
            labels: const ['All', 'Active', 'Completed'],
            selected: _filter,
            onSelect: (i) => setState(() => _filter = i),
          ),
        ),
        const SizedBox(height: 20),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_loading)
                const EcoLoadingState(
                  title: 'Loading your pickups',
                  message: 'Checking the latest updates.',
                  compact: true,
                )
              else if (_failed)
                EcoLoadError(onRetry: reload)
              else if (_filtered.isEmpty)
                EcoEmptyState(
                  icon: Icons.local_shipping_outlined,
                  title: _filter == 2
                      ? 'Your impact starts here'
                      : 'No pickups here yet',
                  message: _filter == 2
                      ? 'Completed pickups will appear here. Each one makes a difference.'
                      : 'Gather your recyclables and arrange your next pickup.',
                  action: 'Request a pickup',
                  onAction: widget.onRequestPickup,
                )
              else
                ..._filtered.map(
                  (pickup) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: EcoPickupCard(
                      pickup: pickup,
                      onTap: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => PickupDetailScreen(
                              pickupId: pickup['id'] as String,
                            ),
                          ),
                        );
                        if (mounted) reload();
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}
