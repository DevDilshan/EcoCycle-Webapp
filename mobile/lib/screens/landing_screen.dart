import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';
import 'login_screen.dart';
import 'register_screen.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
      backgroundColor: EcoColors.ivory,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: _HeroBlock(
              onLogin: () => _openLogin(context),
              onRegister: () => _openRegister(context),
            ),
          ),
          SliverToBoxAdapter(child: _HowItWorks()),
          SliverToBoxAdapter(child: _ImpactStrip()),
          SliverToBoxAdapter(child: _Features()),
          SliverToBoxAdapter(
            child: _CtaBand(
              onRegister: () => _openRegister(context),
              onLogin: () => _openLogin(context),
            ),
          ),
          SliverToBoxAdapter(child: _LandingFooter()),
        ],
      ),
    ),
    );
  }

  void _openLogin(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const LoginScreen()),
    );
  }

  void _openRegister(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const RegisterScreen()),
    );
  }
}

class _HeroBlock extends StatelessWidget {
  const _HeroBlock({required this.onLogin, required this.onRegister});

  final VoidCallback onLogin;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    const heroHeight = 580.0;

    return SizedBox(
      height: heroHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const _HeroBackground(),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF003424).withValues(alpha: 0.88),
                  const Color(0xFF00563B).withValues(alpha: 0.82),
                  const Color(0xFF00563B).withValues(alpha: 0.55),
                ],
                stops: const [0.0, 0.45, 1.0],
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _HeroNav(onLogin: onLogin, onRegister: onRegister),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 12, 24, 72),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _HeroEyebrow(),
                        const SizedBox(height: 16),
                        RichText(
                          text: TextSpan(
                            style: TextStyle(
                              fontSize: 40,
                              fontWeight: FontWeight.w800,
                              height: 1.05,
                              letterSpacing: -0.035 * 16,
                              color: EcoColors.ivory,
                            ),
                            children: const [
                              TextSpan(text: 'Give your waste a '),
                              TextSpan(
                                text: 'second life.',
                                style: TextStyle(color: EcoColors.celadon),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'One photo is all it takes. We sort it, route it and collect it, usually within 48 hours. Free for residents, and you earn reward points every time.',
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.55,
                            color: EcoColors.ivory.withValues(alpha: 0.88),
                          ),
                        ),
                        const Spacer(),
                        EcoPrimaryButton(
                          label: 'Request a pickup',
                          icon: Icons.arrow_forward_rounded,
                          color: EcoColors.celadon,
                          labelColor: EcoColors.green,
                          onPressed: onRegister,
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Icon(Icons.location_on_outlined, size: 18, color: EcoColors.celadon),
                            const SizedBox(width: 6),
                            Text(
                              'Serving Colombo & suburbs',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: EcoColors.ivory.withValues(alpha: 0.85),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Align(
            alignment: Alignment.bottomCenter,
            child: _HeroWave(),
          ),
        ],
      ),
    );
  }
}

class _HeroBackground extends StatelessWidget {
  const _HeroBackground();

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/images/seedling-in-hand.jpg',
      fit: BoxFit.cover,
      alignment: const Alignment(0.72, 0.42),
      errorBuilder: (_, __, ___) => Container(color: EcoColors.green),
    );
  }
}

class _HeroNav extends StatelessWidget {
  const _HeroNav({required this.onLogin, required this.onRegister});

  final VoidCallback onLogin;
  final VoidCallback onRegister;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
          decoration: BoxDecoration(
            color: EcoColors.ivory.withValues(alpha: 0.12),
            border: Border(
              bottom: BorderSide(color: EcoColors.ivory.withValues(alpha: 0.15)),
            ),
          ),
          child: Row(
            children: [
              const _HeroBrand(),
              const Spacer(),
              TextButton(
                onPressed: onLogin,
                style: TextButton.styleFrom(
                  foregroundColor: EcoColors.ivory,
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
                child: const Text('Log in', style: TextStyle(fontWeight: FontWeight.w600)),
              ),
              const SizedBox(width: 4),
              Material(
                color: EcoColors.celadon,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: onRegister,
                  borderRadius: BorderRadius.circular(12),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Text(
                      'Get started',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: EcoColors.green,
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

class _HeroBrand extends StatelessWidget {
  const _HeroBrand();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: EcoColors.ivory,
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: const Text(
            'E',
            style: TextStyle(
              color: EcoColors.green,
              fontWeight: FontWeight.w800,
              fontSize: 17,
            ),
          ),
        ),
        const SizedBox(width: 8),
        const Text(
          'EcoCycle',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: EcoColors.ivory,
            letterSpacing: -0.02 * 16,
          ),
        ),
      ],
    );
  }
}

class _HeroEyebrow extends StatelessWidget {
  const _HeroEyebrow();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: EcoColors.celadon.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.eco_outlined, size: 14, color: EcoColors.celadon),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              'Smart waste & recycling pickup',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: EcoColors.celadon.withValues(alpha: 0.95),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroWave extends StatelessWidget {
  const _HeroWave();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      width: double.infinity,
      child: CustomPaint(
        painter: _WavePainter(EcoColors.ivory),
      ),
    );
  }
}

class _WavePainter extends CustomPainter {
  _WavePainter(this.fill);

  final Color fill;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, size.height * 0.55)
      ..cubicTo(
        size.width * 0.25,
        size.height,
        size.width * 0.55,
        size.height * 0.15,
        size.width,
        size.height * 0.5,
      )
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = fill);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _HowItWorks extends StatelessWidget {
  static const _steps = [
    (
      1,
      Icons.photo_camera_outlined,
      'Submit',
      'Snap a photo of your waste and pick a time that suits you.',
      'assets/images/step-submit.jpg',
      Alignment(0.5, 0.45),
    ),
    (
      2,
      Icons.auto_awesome_outlined,
      'AI classifies',
      'Sorted into recyclable, organic, e-waste or hazardous in seconds.',
      'assets/images/step-classify.jpg',
      Alignment.center,
    ),
    (
      3,
      Icons.route_outlined,
      'Routed',
      'Matched to the right collector for your area, automatically.',
      'assets/images/step-routed.jpg',
      Alignment.center,
    ),
    (
      4,
      Icons.local_shipping_outlined,
      'Collected',
      'Picked up at the kerb—you earn points for recycling right.',
      'assets/images/collection-truck.jpg',
      Alignment(-0.2, 0.5),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Transform.translate(
      offset: const Offset(0, -36),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(24, 0, 24, 16),
              child: Text(
                'How it works',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: EcoColors.green),
              ),
            ),
            SizedBox(
              height: 268,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                scrollDirection: Axis.horizontal,
                itemCount: _steps.length,
                separatorBuilder: (_, __) => const SizedBox(width: 14),
                itemBuilder: (context, i) {
                  final (num, icon, title, body, asset, align) = _steps[i];
                  return _StepCard(
                    step: num,
                    icon: icon,
                    title: title,
                    body: body,
                    imageAsset: asset,
                    imageAlignment: align,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  const _StepCard({
    required this.step,
    required this.icon,
    required this.title,
    required this.body,
    required this.imageAsset,
    required this.imageAlignment,
  });

  final int step;
  final IconData icon;
  final String title;
  final String body;
  final String imageAsset;
  final Alignment imageAlignment;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: EcoColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: EcoColors.green.withValues(alpha: 0.1),
            blurRadius: 28,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 118,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  imageAsset,
                  fit: BoxFit.cover,
                  alignment: imageAlignment,
                  errorBuilder: (_, __, ___) => Container(color: EcoColors.honeydew),
                ),
                Positioned(
                  left: 12,
                  top: 12,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: const BoxDecoration(
                      color: EcoColors.green,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      '$step',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 18, color: EcoColors.green),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: EcoColors.green,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  body,
                  style: const TextStyle(fontSize: 13, color: EcoColors.body, height: 1.45),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ImpactStrip extends StatelessWidget {
  static const _stats = [
    (Icons.groups_outlined, '12,500+', 'Households served'),
    (Icons.schedule_outlined, '8 yrs', 'Waste services'),
    (Icons.recycling_outlined, '340 t', 'Recycled this year'),
    (Icons.auto_awesome_outlined, '96%', 'AI sorting accuracy'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Impact that adds up',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: EcoColors.green),
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final w = (constraints.maxWidth - 12) / 2;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: _stats.map((s) {
                  final (icon, value, label) = s;
                  return SizedBox(
                    width: w,
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: EcoColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: EcoColors.green.withValues(alpha: 0.08)),
                      ),
                      child: Row(
                        children: [
                          EcoIconTile(icon: icon, size: 40),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  value,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 17,
                                    color: EcoColors.green,
                                  ),
                                ),
                                Text(
                                  label,
                                  style: const TextStyle(fontSize: 11, color: EcoColors.body, height: 1.3),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _Features extends StatelessWidget {
  static const _items = [
    (Icons.auto_awesome_outlined, 'AI waste classification', 'Every photo is sorted so the right truck and facility are chosen first time.'),
    (Icons.map_outlined, 'Smart route planning', 'Optimised daily routes by zone—fewer trips and faster pickups.'),
    (Icons.emoji_events_outlined, 'Rewards for recycling', 'Earn points when waste is sorted correctly.'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      color: EcoColors.honeydew,
      padding: const EdgeInsets.fromLTRB(24, 40, 24, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const EcoEyebrow(label: 'Why EcoCycle'),
          const SizedBox(height: 8),
          const Text(
            'Built for residents, collectors and councils',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: EcoColors.green, height: 1.15),
          ),
          const SizedBox(height: 8),
          const Text(
            'One platform from the first photo to the recycling plant.',
            style: TextStyle(fontSize: 16, color: EcoColors.body),
          ),
          const SizedBox(height: 24),
          ..._items.map((item) {
            final (icon, title, body) = item;
            return Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  EcoIconTile(icon: icon, size: 52),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: EcoColors.green)),
                        const SizedBox(height: 4),
                        Text(body, style: const TextStyle(fontSize: 14, color: EcoColors.body, height: 1.45)),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _CtaBand extends StatelessWidget {
  const _CtaBand({required this.onRegister, required this.onLogin});

  final VoidCallback onRegister;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: EcoColors.green,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: EcoColors.green.withValues(alpha: 0.35),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const EcoEyebrow(label: 'Free to join', light: true),
            const SizedBox(height: 8),
            const Text(
              'Your first pickup is a photo away',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: EcoColors.ivory),
            ),
            const SizedBox(height: 8),
            Text(
              'Set up an account in under a minute, then point and shoot.',
              style: TextStyle(fontSize: 15, color: EcoColors.ivory.withValues(alpha: 0.85), height: 1.45),
            ),
            const SizedBox(height: 20),
            EcoSecondaryButton(label: 'Create free account', onPressed: onRegister),
            const SizedBox(height: 10),
            TextButton(
              onPressed: onLogin,
              child: Text(
                'I already have one',
                style: TextStyle(color: EcoColors.ivory.withValues(alpha: 0.9), fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LandingFooter extends StatelessWidget {
  const _LandingFooter();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: EcoColors.honeydew,
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const EcoBrand(),
          const SizedBox(height: 10),
          const Text(
            'Smart waste and recycling pickup for cleaner, greener neighbourhoods.',
            style: TextStyle(fontSize: 14, color: EcoColors.body, height: 1.5),
          ),
          const SizedBox(height: 20),
          Text(
            '© ${DateTime.now().year} EcoCycle',
            style: const TextStyle(fontSize: 13, color: EcoColors.body),
          ),
        ],
      ),
    );
  }
}
