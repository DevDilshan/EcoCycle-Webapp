import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';

class EcoLogo extends StatelessWidget {
  const EcoLogo({super.key, this.size = 60});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: EcoColors.primary,
        borderRadius: BorderRadius.circular(size * 0.3),
      ),
      alignment: Alignment.center,
      child: Text(
        'E',
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: size * 0.5,
        ),
      ),
    );
  }
}

class EcoScreen extends StatelessWidget {
  const EcoScreen({super.key, required this.child, this.bottomNavigationBar});

  final Widget child;
  final Widget? bottomNavigationBar;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EcoColors.canvas,
      body: SafeArea(bottom: bottomNavigationBar == null, child: child),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}

class EcoFieldLabel extends StatelessWidget {
  const EcoFieldLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: EcoColors.label,
        ),
      ),
    );
  }
}

class EcoTextField extends StatelessWidget {
  const EcoTextField({
    super.key,
    this.controller,
    this.hint,
    this.obscure = false,
    this.maxLines = 1,
    this.keyboardType,
    this.readOnly = false,
    this.onTap,
    this.suffix,
  });

  final TextEditingController? controller;
  final String? hint;
  final bool obscure;
  final int maxLines;
  final TextInputType? keyboardType;
  final bool readOnly;
  final VoidCallback? onTap;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: EcoColors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        maxLines: maxLines,
        keyboardType: keyboardType,
        readOnly: readOnly,
        onTap: onTap,
        style: const TextStyle(fontSize: 14, color: EcoColors.ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: obscure ? EcoColors.muted : EcoColors.body,
            letterSpacing: obscure ? 3 : 0,
          ),
          border: InputBorder.none,
          suffixIcon: suffix,
          suffixIconConstraints: const BoxConstraints(minWidth: 32),
        ),
      ),
    );
  }
}

class EcoPrimaryButton extends StatelessWidget {
  const EcoPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.color = EcoColors.primary,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(14),
      elevation: 0,
      child: InkWell(
        onTap: loading ? null : onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: loading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
        ),
      ),
    );
  }
}

class EcoBackHeader extends StatelessWidget {
  const EcoBackHeader({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 22, 12),
      child: Row(
        children: [
          IconButton(
            onPressed: () => Navigator.maybePop(context),
            icon: const Icon(Icons.chevron_left, color: EcoColors.primary, size: 28),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).appBarTheme.titleTextStyle),
                if (subtitle != null) Text(subtitle!, style: ecoMono()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class StripedPhotoZone extends StatelessWidget {
  const StripedPhotoZone({
    super.key,
    this.height = 180,
    this.title,
    this.subtitle,
    this.onTap,
    this.child,
  });

  final double height;
  final String? title;
  final String? subtitle;
  final VoidCallback? onTap;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(title != null ? 20 : 16),
          border: Border.all(color: const Color(0xFFCDBBD0), width: 1.5),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFFEEF3EE), Color(0xFFE7EFE7)],
            stops: [0.0, 1.0],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(title != null ? 20 : 16),
              child: CustomPaint(painter: _StripePainter()),
            ),
            if (child != null)
              child!
            else
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: EcoColors.primary,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: EcoColors.primary.withValues(alpha: 0.55),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: const Text('📷', style: TextStyle(fontSize: 26)),
                    ),
                    if (title != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        title!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ],
                    if (subtitle != null) Text(subtitle!, style: ecoMono()),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StripePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const tile = 20.0;
    final p1 = Paint()..color = const Color(0xFFEEF3EE);
    final p2 = Paint()..color = const Color(0xFFE7EFE7);
    for (var y = 0.0; y < size.height; y += tile) {
      for (var x = 0.0; x < size.width; x += tile) {
        canvas.drawRect(Rect.fromLTWH(x, y, tile, tile), p1);
        canvas.drawRect(Rect.fromLTWH(x, y, tile / 2, tile / 2), p2);
        canvas.drawRect(Rect.fromLTWH(x + tile / 2, y + tile / 2, tile / 2, tile / 2), p2);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.label, required this.tone});

  final String label;
  final BadgeTone tone;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      BadgeTone.scheduled => (const Color(0xFFEFE3FF), EcoColors.purple),
      BadgeTone.pending => (const Color(0xFFF5ECD6), EcoColors.amber),
      BadgeTone.pendingApproval => (const Color(0xFFF7E3E0), EcoColors.danger),
      BadgeTone.classified => (const Color(0xFFE2ECF7), EcoColors.blue),
      BadgeTone.completed => (const Color(0xFFE7EFE7), const Color(0xFF4A6A55)),
      BadgeTone.inReview => (const Color(0xFFF5ECD6), EcoColors.amber),
      BadgeTone.resolved => (const Color(0xFFE7EFE7), EcoColors.primary),
      BadgeTone.next => (EcoColors.mintBg, EcoColors.primary),
      BadgeTone.category => (const Color(0xFFE2ECF7), EcoColors.blue),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

enum BadgeTone {
  scheduled,
  pending,
  pendingApproval,
  classified,
  completed,
  inReview,
  resolved,
  next,
  category,
}

BadgeTone toneForPickupStatus(String status, {bool hasApproval = false}) {
  final s = status.toLowerCase();
  if (hasApproval && s != 'completed') return BadgeTone.pendingApproval;
  return switch (s) {
    'scheduled' => BadgeTone.scheduled,
    'pending' => BadgeTone.pending,
    'classified' => BadgeTone.classified,
    'completed' => BadgeTone.completed,
    'approved' => BadgeTone.scheduled,
    _ => BadgeTone.pending,
  };
}

class EcoBottomNav extends StatelessWidget {
  const EcoBottomNav({
    super.key,
    required this.index,
    required this.onChanged,
    required this.onFab,
  });

  final int index;
  final ValueChanged<int> onChanged;
  final VoidCallback onFab;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFEAEFE9))),
      ),
      padding: const EdgeInsets.fromLTRB(8, 10, 8, 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _NavItem(
            icon: Icons.home_rounded,
            label: 'Home',
            selected: index == 0,
            onTap: () => onChanged(0),
          ),
          _NavItem(
            icon: Icons.list_alt_rounded,
            label: 'Requests',
            selected: index == 1,
            onTap: () => onChanged(1),
          ),
          Transform.translate(
            offset: const Offset(0, -22),
            child: GestureDetector(
              onTap: onFab,
              child: Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: EcoColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: EcoColors.primary.withValues(alpha: 0.55),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 28),
              ),
            ),
          ),
          _NavItem(
            icon: Icons.emoji_events_outlined,
            label: 'Rewards',
            selected: index == 2,
            onTap: () => onChanged(2),
          ),
          _NavItem(
            icon: Icons.person_outline,
            label: 'Profile',
            selected: index == 3,
            onTap: () => onChanged(3),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? EcoColors.primary : EcoColors.muted;
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class FilterPills extends StatelessWidget {
  const FilterPills({
    super.key,
    required this.labels,
    required this.selected,
    required this.onSelect,
  });

  final List<String> labels;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(labels.length, (i) {
          final active = i == selected;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onSelect(i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: active ? EcoColors.primary : Colors.white,
                  border: Border.all(
                    color: active ? EcoColors.primary : EcoColors.border,
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  labels[i],
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                    color: active ? Colors.white : EcoColors.body,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
