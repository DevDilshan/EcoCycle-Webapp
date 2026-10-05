import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';
import 'reward_artwork.dart';

String rewardDeliveryLabel(Object? delivery) => switch (delivery) {
  'Email' => 'Sent by email',
  'Post' => 'Sent by post',
  _ => 'Collect in person',
};

String _morePoints(int value) =>
    '$value more ${value == 1 ? 'point' : 'points'}';

/// All rewards open details, including those the resident cannot afford yet.
/// The request itself remains a separate, confirmed action.
class RewardCatalogCard extends StatelessWidget {
  const RewardCatalogCard({
    super.key,
    required this.item,
    required this.available,
    required this.onTap,
    this.horizontal = false,
  });

  final Map<String, dynamic> item;
  final int available;
  final VoidCallback onTap;
  final bool horizontal;

  @override
  Widget build(BuildContext context) {
    final name = item['name'] as String? ?? 'Reward';
    final cost = (item['pointsCost'] as num?)?.toInt() ?? 0;
    final stock = (item['stock'] as num?)?.toInt();
    final soldOut = stock != null && stock <= 0;
    final shortfall = cost - available;
    final caption = soldOut
        ? 'Currently sold out'
        : shortfall > 0
        ? '${_morePoints(shortfall)} to go'
        : 'Within your points';
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          name,
          maxLines: horizontal ? 3 : 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 14,
            height: 1.4,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '$cost points',
          style: const TextStyle(
            color: EcoColors.green,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          caption,
          style: TextStyle(
            fontSize: 12,
            height: 1.4,
            color: soldOut ? EcoColors.muted : EcoColors.body,
          ),
        ),
        const SizedBox(height: 12),
        const Row(
          children: [
            Expanded(
              child: Text(
                'View reward',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: EcoColors.green,
                ),
              ),
            ),
            Icon(Icons.arrow_forward_rounded, size: 18, color: EcoColors.green),
          ],
        ),
      ],
    );
    return Semantics(
      button: true,
      onTap: onTap,
      label: '$name, $cost points. $caption. View details',
      child: ExcludeSemantics(
        child: Material(
          color: EcoColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
            side: const BorderSide(color: EcoColors.cardBorder),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: horizontal
                  ? Row(
                      children: [
                        RewardArtwork(
                          imageUrl: item['imageUrl'] as String?,
                          itemName: item['name'] as String?,
                          size: 96,
                        ),
                        const SizedBox(width: 14),
                        Expanded(child: details),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: RewardArtwork(
                            imageUrl: item['imageUrl'] as String?,
                            itemName: item['name'] as String?,
                            size: 126,
                          ),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          height:
                              MediaQuery.textScalerOf(context).scale(14) * 2.8,
                          child: Align(
                            alignment: Alignment.topLeft,
                            child: Text(
                              name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14,
                                height: 1.4,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        Text(
                          '$cost points',
                          style: const TextStyle(
                            color: EcoColors.green,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          caption,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.4,
                            color: EcoColors.body,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Row(
                          children: [
                            Expanded(
                              child: Text(
                                'View reward',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: EcoColors.green,
                                ),
                              ),
                            ),
                            Icon(
                              Icons.arrow_forward_rounded,
                              size: 18,
                              color: EcoColors.green,
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}

class RewardCatalogGrid extends StatelessWidget {
  const RewardCatalogGrid({
    super.key,
    required this.items,
    required this.available,
    required this.onTap,
  });
  final List<Map<String, dynamic>> items;
  final int available;
  final ValueChanged<Map<String, dynamic>> onTap;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final twoColumns =
          constraints.maxWidth >= 320 &&
          MediaQuery.textScalerOf(context).scale(14) <= 18;
      final width = twoColumns
          ? (constraints.maxWidth - 12) / 2
          : constraints.maxWidth;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final item in items)
            SizedBox(
              width: width,
              child: RewardCatalogCard(
                item: item,
                available: available,
                horizontal: !twoColumns,
                onTap: () => onTap(item),
              ),
            ),
        ],
      );
    },
  );
}

Future<bool?> showRewardDetails(
  BuildContext context, {
  required Map<String, dynamic> item,
  required int available,
  required bool busy,
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  useSafeArea: true,
  showDragHandle: true,
  backgroundColor: EcoColors.ivory,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
  ),
  builder: (ctx) {
    final cost = (item['pointsCost'] as num?)?.toInt() ?? 0;
    final stock = (item['stock'] as num?)?.toInt();
    final soldOut = stock != null && stock <= 0;
    final canRequest = !busy && !soldOut && cost <= available;
    final description = item['description'] as String?;
    final instructions = item['deliveryInstructions'] as String?;
    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(ctx).height * .85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  tooltip: 'Close reward details',
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close_rounded),
                ),
              ),
              Center(
                child: RewardArtwork(
                  imageUrl: item['imageUrl'] as String?,
                  itemName: item['name'] as String?,
                  size: 180,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                item['name'] as String? ?? 'Reward',
                style: const TextStyle(
                  fontSize: 24,
                  height: 1.25,
                  fontWeight: FontWeight.w800,
                  color: EcoColors.green,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                '$cost points',
                style: const TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                  color: EcoColors.green,
                ),
              ),
              if (description != null && description.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.6,
                    color: EcoColors.body,
                  ),
                ),
              ],
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: EcoColors.honeydew,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rewardDeliveryLabel(item['delivery']),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      soldOut
                          ? 'Currently out of stock'
                          : stock == null
                          ? 'Available to request'
                          : '$stock available',
                      style: const TextStyle(
                        color: EcoColors.body,
                        fontSize: 13,
                      ),
                    ),
                    if (instructions != null && instructions.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        instructions,
                        style: const TextStyle(
                          color: EcoColors.body,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'You have ${available < 0 ? 0 : available} available points. Requests wait for approval before points are spent.',
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: EcoColors.body,
                ),
              ),
              if (!soldOut && cost > available) ...[
                const SizedBox(height: 10),
                Text(
                  'Earn ${_morePoints(cost - available)} to request this reward.',
                  style: const TextStyle(
                    color: EcoColors.green,
                    fontWeight: FontWeight.w700,
                    height: 1.5,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton(
                onPressed: canRequest ? () => Navigator.pop(ctx, true) : null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                ),
                child: Text(
                  soldOut
                      ? 'Sold out'
                      : cost > available
                      ? 'Keep recycling to unlock'
                      : 'Request reward',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  },
);
