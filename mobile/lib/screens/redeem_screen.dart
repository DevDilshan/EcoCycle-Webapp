import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';

class RedeemScreen extends StatelessWidget {
  const RedeemScreen({super.key, required this.balance});

  final int balance;

  @override
  Widget build(BuildContext context) {
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EcoBackHeader(title: 'Redeem'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: EcoColors.cardBorder),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Available', style: TextStyle(fontSize: 13, color: EcoColors.body)),
                      Text('$balance pts', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: EcoColors.primary)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _RedeemCard(emoji: '🛍️', title: 'Rs 500 grocery voucher', cost: 100, locked: balance < 100),
                _RedeemCard(emoji: '🚌', title: 'Transit credit', cost: 250, locked: balance < 250),
                _RedeemCard(emoji: '🌳', title: 'Plant a tree donation', cost: 1500, locked: true),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: EcoColors.mintBg,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Text(
                    '💡 Redeeming does not affect your streak — keep recycling correctly to climb the leaderboard.',
                    style: TextStyle(fontSize: 12, height: 1.5, color: EcoColors.label),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RedeemCard extends StatelessWidget {
  const _RedeemCard({
    required this.emoji,
    required this.title,
    required this.cost,
    required this.locked,
  });

  final String emoji;
  final String title;
  final int cost;
  final bool locked;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.cardBorder),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: EcoColors.mintBg,
              borderRadius: BorderRadius.circular(14),
            ),
            alignment: Alignment.center,
            child: Text(emoji, style: const TextStyle(fontSize: 22)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text('$cost points', style: const TextStyle(fontSize: 12, color: EcoColors.body)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: locked ? const Color(0xFFEEF3EE) : EcoColors.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              locked ? 'Locked' : 'Redeem',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 12,
                color: locked ? EcoColors.muted : Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
