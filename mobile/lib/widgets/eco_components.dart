import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';

class EcoLogo extends StatelessWidget {
  const EcoLogo({super.key, this.size = 36, this.cornerRadius});

  final double size;
  final double? cornerRadius;

  @override
  Widget build(BuildContext context) {
    final radius = cornerRadius ?? (size >= 48 ? 12.0 : 10.0);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: EcoColors.green,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: EcoColors.green.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Image.asset(
        'assets/images/brand/ecocycle-mark-light.webp',
        width: size * .74,
        height: size * .74,
        fit: BoxFit.contain,
        excludeFromSemantics: true,
      ),
    );
  }
}

class EcoBrand extends StatelessWidget {
  const EcoBrand({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        EcoLogo(size: compact ? 32 : 36),
        const SizedBox(width: 10),
        Text(
          'EcoCycle',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: compact ? 17 : 19,
            color: EcoColors.green,
            letterSpacing: -0.02 * 16,
          ),
        ),
      ],
    );
  }
}

class EcoEyebrow extends StatelessWidget {
  const EcoEyebrow({
    super.key,
    required this.label,
    this.icon,
    this.light = false,
  });

  final String label;
  final IconData? icon;
  final bool light;

  @override
  Widget build(BuildContext context) {
    final fg = light ? EcoColors.ivory.withValues(alpha: 0.9) : EcoColors.green;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 16, color: fg),
          const SizedBox(width: 6),
        ],
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.08 * 16,
            color: fg,
          ),
        ),
      ],
    );
  }
}

class EcoIconTile extends StatelessWidget {
  const EcoIconTile({super.key, required this.icon, this.size = 48});

  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: EcoColors.celadon.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(size * 0.28),
      ),
      alignment: Alignment.center,
      child: Icon(icon, color: EcoColors.green, size: size * 0.45),
    );
  }
}

class EcoAuthScaffold extends StatelessWidget {
  const EcoAuthScaffold({super.key, required this.child, this.onBack});

  final Widget child;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final canGoBack = Navigator.of(context).canPop();
    return Scaffold(
      backgroundColor: EcoColors.ivory,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: EcoBrand(compact: true),
                    ),
                  ),
                  if (canGoBack || onBack != null)
                    TextButton.icon(
                      onPressed: onBack ?? () => Navigator.maybePop(context),
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        size: 18,
                        color: EcoColors.green,
                      ),
                      label: const Text(
                        'Back',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: EcoColors.green,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: Align(
                alignment: Alignment.topCenter,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                  child: Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxWidth: 440),
                    padding: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: EcoColors.ivory,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: child,
                  ),
                ),
              ),
            ),
          ],
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
          fontSize: 13,
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
    this.prefixIcon,
    this.suffix,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController? controller;
  final String? hint;
  final bool obscure;
  final int maxLines;
  final TextInputType? keyboardType;
  final bool readOnly;
  final VoidCallback? onTap;
  final IconData? prefixIcon;
  final Widget? suffix;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: EcoColors.surface,
        border: Border.all(color: EcoColors.green.withValues(alpha: 0.12)),
        borderRadius: BorderRadius.circular(14),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        maxLines: maxLines,
        keyboardType: keyboardType,
        readOnly: readOnly,
        onTap: onTap,
        textInputAction: textInputAction,
        onSubmitted: onSubmitted,
        style: const TextStyle(fontSize: 14, color: EcoColors.ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: obscure ? EcoColors.muted : EcoColors.body,
            letterSpacing: obscure ? 3 : 0,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 12,
          ),
          prefixIcon: prefixIcon != null
              ? Icon(prefixIcon, size: 20, color: EcoColors.body)
              : null,
          prefixIconConstraints: const BoxConstraints(minWidth: 44),
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
    this.labelColor = Colors.white,
    this.icon,
    this.compact = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Color color;
  final Color labelColor;
  final IconData? icon;
  final bool compact;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final vPad = compact ? 10.0 : 16.0;
    final hPad = compact ? 16.0 : 0.0;
    final labelWidget = Text(
      label,
      textAlign: TextAlign.center,
      style: TextStyle(
        color: labelColor,
        fontWeight: FontWeight.w700,
        fontSize: compact ? 14 : 15,
      ),
    );
    return Material(
      color: color,
      borderRadius: BorderRadius.circular(14),
      elevation: 0,
      child: InkWell(
        onTap: loading ? null : onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: expand ? double.infinity : null,
          padding: EdgeInsets.symmetric(vertical: vPad, horizontal: hPad),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.1),
                blurRadius: compact ? 8 : 12,
                offset: Offset(0, compact ? 3 : 5),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: loading
              ? SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: labelColor,
                  ),
                )
              : Row(
                  mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (expand) Flexible(child: labelWidget) else labelWidget,
                    if (icon != null) ...[
                      const SizedBox(width: 8),
                      Icon(icon, color: labelColor, size: 20),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}

class EcoSecondaryButton extends StatelessWidget {
  const EcoSecondaryButton({super.key, required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: EcoColors.ivory,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14),
          alignment: Alignment.center,
          child: Text(
            label,
            style: const TextStyle(
              color: EcoColors.green,
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
            icon: const Icon(
              Icons.chevron_left,
              color: EcoColors.primary,
              size: 28,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).appBarTheme.titleTextStyle,
                ),
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
        canvas.drawRect(
          Rect.fromLTWH(x + tile / 2, y + tile / 2, tile / 2, tile / 2),
          p2,
        );
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
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg),
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
      decoration: BoxDecoration(
        color: EcoColors.ivory,
        border: Border(
          top: BorderSide(color: EcoColors.green.withValues(alpha: 0.08)),
        ),
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
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 7,
                ),
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
