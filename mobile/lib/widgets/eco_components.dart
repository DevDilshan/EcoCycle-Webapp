import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
        filterQuality: FilterQuality.high,
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
            fontSize: 12,
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
      // Reserve the full bar and Android gesture inset instead of letting
      // large-text content and the pickup action overlap one another.
      extendBody: false,
      body: SafeArea(bottom: bottomNavigationBar == null, child: child),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}

/// The Scaffold reserves the navigation bar and system inset separately.
double ecoNavClearance(BuildContext context) => 24;

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
    this.onChanged,
    this.maxLength,
    this.inputFormatters,
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
  final ValueChanged<String>? onChanged;
  final int? maxLength;
  final List<TextInputFormatter>? inputFormatters;

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
        onChanged: onChanged,
        maxLength: maxLength,
        inputFormatters: inputFormatters,
        style: const TextStyle(fontSize: 14, color: EcoColors.ink),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            fontWeight: FontWeight.w500,
            color: EcoColors.body,
            letterSpacing: obscure ? 3 : 0,
          ),
          counterText: '',
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 12,
            vertical: 12,
          ),
          prefixIcon: prefixIcon != null
              ? Icon(prefixIcon, size: 20, color: EcoColors.green)
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
      color: EcoColors.surface,
      // Outlined, so it reads as a button and not as a line of text on the
      // ivory page it usually sits on.
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: EcoColors.green.withValues(alpha: .28)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
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

/// For actions that remove something or cannot be undone: delete account,
/// report a stop as not collected. Tinted and outlined in red so it is
/// clearly a button, without competing with the green primary action.
class EcoDangerButton extends StatelessWidget {
  const EcoDangerButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return Opacity(
      opacity: enabled || loading ? 1 : .5,
      child: Material(
        color: EcoColors.dangerBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: BorderSide(color: EcoColors.danger.withValues(alpha: .35)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (loading)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: EcoColors.danger,
                      ),
                    )
                  else ...[
                    if (icon != null) ...[
                      Icon(icon, size: 20, color: EcoColors.danger),
                      const SizedBox(width: 8),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: EcoColors.danger,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
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
            tooltip: 'Back',
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
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    height: 1.3,
                    color: EcoColors.green,
                  ),
                ),
                if (subtitle != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 13,
                        color: EcoColors.body,
                        height: 1.5,
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
  Widget build(BuildContext context) => Material(
    color: EcoColors.honeydew,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(22),
      side: BorderSide(color: EcoColors.green.withValues(alpha: .16)),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: child != null
          ? SizedBox(height: height, width: double.infinity, child: child)
          : ConstrainedBox(
              constraints: BoxConstraints(minHeight: height),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      onTap == null
                          ? Icons.image_outlined
                          : Icons.add_a_photo_outlined,
                      size: 34,
                      color: EcoColors.green,
                    ),
                    if (title != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        title!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 15,
                          height: 1.4,
                          fontWeight: FontWeight.w800,
                          color: EcoColors.green,
                        ),
                      ),
                    ],
                    if (subtitle != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        subtitle!,
                        textAlign: TextAlign.center,
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
            ),
    ),
  );
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
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg),
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

/// One destination in the bottom bar: outlined icon, filled icon, label.
typedef EcoDestination = (IconData, IconData, String);

/// The raised button that sits in the bar's notch.
class EcoNavAction {
  const EcoNavAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// The resident bar: two destinations either side of "request a pickup".
class EcoBottomNav extends StatelessWidget {
  const EcoBottomNav({
    super.key,
    required this.index,
    required this.onChanged,
    required this.onRequestPickup,
  });
  final int index;
  final ValueChanged<int> onChanged;
  final VoidCallback onRequestPickup;
  @override
  Widget build(BuildContext context) => EcoNavigationBar(
    index: index,
    onChanged: onChanged,
    destinations: const [
      (Icons.home_outlined, Icons.home_rounded, 'Home'),
      (Icons.local_shipping_outlined, Icons.local_shipping_rounded, 'Pickups'),
      (Icons.card_giftcard_outlined, Icons.card_giftcard_rounded, 'Rewards'),
      (Icons.person_outline_rounded, Icons.person_rounded, 'Profile'),
    ],
    centerAction: EcoNavAction(
      icon: Icons.add_rounded,
      label: 'Request a pickup',
      onTap: onRequestPickup,
    ),
  );
}

/// A floating bar with a dot under the selected destination. With a
/// [centerAction] the bar dips in the middle and the action sits in the dip,
/// so the one thing a resident comes to do is always under the thumb.
class EcoNavigationBar extends StatelessWidget {
  const EcoNavigationBar({
    super.key,
    required this.index,
    required this.onChanged,
    required this.destinations,
    this.centerAction,
  });
  final int index;
  final ValueChanged<int> onChanged;
  final List<EcoDestination> destinations;
  final EcoNavAction? centerAction;

  static const _barHeight = 68.0;
  static const _actionSize = 58.0;
  // How far the action rises above the bar's top edge.
  static const _lift = 26.0;
  static const _notchGap = 86.0;

  @override
  Widget build(BuildContext context) {
    final action = centerAction;
    final textScale = MediaQuery.textScalerOf(context).scale(12) / 12;
    final showLabels =
        MediaQuery.sizeOf(context).width >= 360 && textScale <= 1.2;
    final barHeight = showLabels
        ? 76.0 + (textScale - 1).clamp(0.0, .2) * 32
        : _barHeight;
    final compact = MediaQuery.sizeOf(context).width < 400;
    // Icons keep a stable footprint at every Android font setting. Accessible
    // names and tooltips remain, without moving the action out of its notch.
    const lift = _lift;
    final half = destinations.length ~/ 2;
    final items = <Widget>[
      for (var i = 0; i < destinations.length; i++) ...[
        if (action != null && i == half)
          SizedBox(width: compact ? 66 : _notchGap),
        Expanded(
          child: _EcoNavItem(
            destination: destinations[i],
            selected: index == i,
            showLabel: showLabels,
            onTap: () => onChanged(i),
          ),
        ),
      ],
    ];
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.fromLTRB(compact ? 8 : 14, 4, compact ? 8 : 14, 10),
        child: SizedBox(
          height: barHeight + (action == null ? 0 : lift),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: barHeight,
                child: CustomPaint(
                  key: const ValueKey('eco-nav-surface'),
                  painter: _EcoNavBarPainter(notched: action != null),
                  child: Material(
                    type: MaterialType.transparency,
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: compact ? 4 : 6,
                      ),
                      child: Row(children: items),
                    ),
                  ),
                ),
              ),
              if (action != null)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Semantics(
                      button: true,
                      label: action.label,
                      child: Tooltip(
                        message: action.label,
                        excludeFromSemantics: true,
                        child: Material(
                          color: EcoColors.green,
                          shape: const CircleBorder(),
                          elevation: 6,
                          shadowColor: EcoColors.green.withValues(alpha: .45),
                          child: InkWell(
                            onTap: action.onTap,
                            customBorder: const CircleBorder(),
                            child: SizedBox(
                              width: _actionSize,
                              height: _actionSize,
                              child: Icon(
                                action.icon,
                                size: 30,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EcoNavItem extends StatelessWidget {
  const _EcoNavItem({
    required this.destination,
    required this.selected,
    required this.showLabel,
    required this.onTap,
  });
  final EcoDestination destination;
  final bool selected;
  final bool showLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (outline, filled, label) = destination;
    final color = selected ? EcoColors.green : EcoColors.body;
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 180);
    return Semantics(
      selected: selected,
      button: true,
      label: label,
      onTap: onTap,
      child: ExcludeSemantics(
        child: Tooltip(
          message: label,
          excludeFromSemantics: true,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: duration,
                  padding: EdgeInsets.all(showLabel ? 3 : 9),
                  decoration: BoxDecoration(
                    color: selected ? EcoColors.honeydew : Colors.transparent,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    selected ? filled : outline,
                    size: 24,
                    color: color,
                  ),
                ),
                if (showLabel) ...[
                  const SizedBox(height: 3),
                  Text(
                    label,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      height: 1.3,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                      color: color,
                    ),
                  ),
                ],
                const SizedBox(height: 4),
                AnimatedContainer(
                  duration: duration,
                  width: selected ? 6 : 0,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: EcoColors.green,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The bar's surface: a rounded slab, optionally dipping in the middle to
/// make room for the raised action.
class _EcoNavBarPainter extends CustomPainter {
  const _EcoNavBarPainter({required this.notched});
  final bool notched;

  static const _radius = 26.0;
  static const _notchHalfWidth = 62.0;
  static const _notchDepth = 36.0;

  Path _outline(Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final path = Path()..moveTo(_radius, 0);
    if (notched) {
      path
        ..lineTo(cx - _notchHalfWidth, 0)
        ..cubicTo(cx - 38, 0, cx - 40, _notchDepth, cx, _notchDepth)
        ..cubicTo(cx + 40, _notchDepth, cx + 38, 0, cx + _notchHalfWidth, 0);
    }
    return path
      ..lineTo(w - _radius, 0)
      ..arcToPoint(Offset(w, _radius), radius: const Radius.circular(_radius))
      ..lineTo(w, h - _radius)
      ..arcToPoint(
        Offset(w - _radius, h),
        radius: const Radius.circular(_radius),
      )
      ..lineTo(_radius, h)
      ..arcToPoint(
        Offset(0, h - _radius),
        radius: const Radius.circular(_radius),
      )
      ..lineTo(0, _radius)
      ..arcToPoint(
        const Offset(_radius, 0),
        radius: const Radius.circular(_radius),
      )
      ..close();
  }

  @override
  void paint(Canvas canvas, Size size) {
    final path = _outline(size);
    canvas
      ..drawPath(
        path.shift(const Offset(0, 5)),
        Paint()
          ..color = EcoColors.green.withValues(alpha: .10)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12),
      )
      ..drawPath(path, Paint()..color = EcoColors.surface)
      ..drawPath(
        path,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1
          ..color = EcoColors.border,
      );
  }

  @override
  bool shouldRepaint(_EcoNavBarPainter oldDelegate) =>
      notched != oldDelegate.notched;
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

  /// Wrapped onto as many lines as the chips need, rather than scrolled
  /// sideways.
  ///
  /// This was a horizontal SingleChildScrollView, which worked while there were
  /// three short labels and nothing ran off the screen. With five -- and counts
  /// on each -- the last chips sat beyond the edge, and dragging to reach them is
  /// unreliable: every chip claims the touch for its own tap, so the swipe is as
  /// likely to select a filter as to scroll past it. A filter nobody can reach is
  /// a filter that does not exist.
  ///
  /// Wrapping also means every option is visible at once, which is the point of
  /// showing counts beside them.
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 8,
    children: List.generate(
      labels.length,
      (i) => ChoiceChip(
        label: Text(labels[i]),
        selected: i == selected,
        showCheckmark: false,
        onSelected: (_) => onSelect(i),
        selectedColor: EcoColors.green,
        backgroundColor: EcoColors.surface,
        labelStyle: TextStyle(
          fontFamily: 'Manrope',
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: i == selected ? Colors.white : EcoColors.body,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        // The default chip reserves room for a Material tap target that makes
        // each one noticeably taller than it looks; with two rows of them that
        // added a visible band of dead space.
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
        side: const BorderSide(color: EcoColors.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );
}
