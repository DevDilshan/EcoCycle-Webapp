import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../theme/eco_theme.dart';
import '../utils/pickup_approval_ui.dart';
import 'eco_components.dart';

class EcoPageHeading extends StatelessWidget {
  const EcoPageHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });
  final String title;
  final String? subtitle;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(22, 20, 22, 24),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 28,
                    height: 1.2,
                    letterSpacing: -.8,
                    fontWeight: FontWeight.w800,
                    color: EcoColors.green,
                  ),
                ),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 8),
                Text(
                  subtitle!,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: EcoColors.body,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 12), trailing!],
      ],
    ),
  );
}

class EcoCard extends StatelessWidget {
  const EcoCard({
    super.key,
    required this.child,
    this.onTap,
    this.color = EcoColors.surface,
    this.padding = const EdgeInsets.all(18),
  });
  final Widget child;
  final VoidCallback? onTap;
  final Color color;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: const BorderSide(color: EcoColors.cardBorder),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(padding: padding, child: child),
    ),
  );
}

class EcoSectionHeading extends StatelessWidget {
  const EcoSectionHeading(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: EcoColors.ink,
              ),
            ),
          ),
        ),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    ),
  );
}

class EcoEmptyState extends StatelessWidget {
  const EcoEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
    this.onAction,
  });
  final IconData icon;
  final String title;
  final String message;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => EcoCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: EcoIconTile(icon: icon, size: 52),
        ),
        const SizedBox(height: 16),
        Text(
          title,
          style: const TextStyle(
            fontSize: 17,
            height: 1.3,
            fontWeight: FontWeight.w800,
            color: EcoColors.green,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          style: const TextStyle(
            fontSize: 13,
            height: 1.6,
            color: EcoColors.body,
          ),
        ),
        if (action != null) ...[
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: onAction,
              icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              label: Text(action!),
            ),
          ),
        ],
      ],
    ),
  );
}

class EcoLoadError extends StatelessWidget {
  const EcoLoadError({
    super.key,
    required this.onRetry,
    this.message = 'We couldn’t load your details. Please try again.',
  });
  final VoidCallback onRetry;
  final String message;
  @override
  Widget build(BuildContext context) => EcoEmptyState(
    icon: Icons.cloud_off_outlined,
    title: 'Let’s try that again',
    message: message,
    action: 'Try again',
    onAction: onRetry,
  );
}

String pickupDate(Map<String, dynamic> pickup) {
  final date = DateTime.tryParse(pickup['preferredDate'] as String? ?? '');
  return date == null
      ? 'Date to be confirmed'
      : DateFormat('EEE, d MMM').format(date.toLocal());
}

bool activePickup(Map<String, dynamic> pickup) => ![
  'completed',
  'cancelled',
  'rejected',
].contains((pickup['status'] as String? ?? '').toLowerCase());

class EcoPickupCard extends StatelessWidget {
  const EcoPickupCard({super.key, required this.pickup, required this.onTap});
  final Map<String, dynamic> pickup;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final status = pickup['status'] as String? ?? 'Pending';
    final (label, tone) = pickup['hasApprovalRequest'] == true
        ? residentApprovalBadge(pickup)
        : (status, toneForPickupStatus(status));
    return EcoCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              StatusBadge(label: label, tone: tone),
              if (pickup['isRecurring'] == true)
                const StatusBadge(label: 'Recurring', tone: BadgeTone.next),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const EcoIconTile(icon: Icons.recycling_rounded, size: 44),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pickup['description'] as String? ?? 'Recycling pickup',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        height: 1.4,
                        color: EcoColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      pickup['category'] as String? ??
                          'Awaiting classification',
                      style: const TextStyle(
                        fontSize: 13,
                        color: EcoColors.body,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: EcoColors.green,
                size: 22,
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 14),
            child: Divider(height: 1, color: EcoColors.border),
          ),
          Row(
            children: [
              const Icon(Icons.event_outlined, size: 17, color: EcoColors.body),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Preferred: ${pickupDate(pickup)}',
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.4,
                    color: EcoColors.body,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class EcoPointsCard extends StatelessWidget {
  const EcoPointsCard({
    super.key,
    required this.balance,
    this.subtitle = 'Every pickup brings you closer to your next reward.',
  });
  final int balance;
  final String subtitle;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      color: EcoColors.green,
      borderRadius: BorderRadius.circular(26),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Row(
          children: [
            Icon(Icons.eco_outlined, color: EcoColors.celadon, size: 22),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Your recycling rewards',
                style: TextStyle(
                  color: EcoColors.honeydew,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text.rich(
          TextSpan(
            children: [
              TextSpan(
                text: NumberFormat('#,###').format(balance),
                style: const TextStyle(
                  fontSize: 44,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.5,
                ),
              ),
              const TextSpan(
                text: ' points',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          style: const TextStyle(color: Colors.white, height: 1.2),
        ),
        const SizedBox(height: 12),
        Text(
          subtitle,
          style: const TextStyle(
            color: EcoColors.honeydew,
            fontSize: 13,
            height: 1.6,
          ),
        ),
      ],
    ),
  );
}
