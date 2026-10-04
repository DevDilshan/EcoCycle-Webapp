import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key, required this.onComplete});

  /// The preference is saved by AuthGate before opening login or registration.
  final Future<void> Function(bool createAccount) onComplete;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _controller = PageController();
  int _page = 0;
  bool _finishing = false;
  String? _error;

  static const _pages = [
    (
      image: 'assets/images/generated/recycling-garden.webp',
      label: 'A greener beginning',
      title: 'Give your waste\na second life.',
      body:
          'Recycle from home with simple pickups and rewards for doing your part.',
    ),
    (
      image: 'assets/images/generated/photo-to-pickup.webp',
      label: 'From your doorstep',
      title: 'One photo.\nA simpler pickup.',
      body:
          'Snap your waste and choose a time. We’ll find the right collector.',
    ),
    (
      image: 'assets/images/generated/recycling-rewards.webp',
      label: 'Every pickup counts',
      title: 'Small steps.\nLasting rewards.',
      body:
          'Track every pickup. Earn recycling points. Make a lasting difference.',
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _finish(bool createAccount) async {
    if (_finishing) return;
    setState(() {
      _finishing = true;
      _error = null;
    });
    try {
      await widget.onComplete(createAccount);
    } catch (_) {
      if (mounted) {
        setState(() {
          _finishing = false;
          _error = 'Could not save your progress. Please try again.';
        });
      }
    }
  }

  void _goTo(int page) {
    if (_finishing) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.jumpToPage(page);
    } else {
      _controller.animateToPage(
        page,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lastPage = _page == _pages.length - 1;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: EcoColors.ivory,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
                child: Row(
                  children: [
                    if (_page == 0)
                      const Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: EcoBrand(compact: true),
                        ),
                      )
                    else
                      IconButton(
                        tooltip: 'Previous introduction',
                        onPressed: _finishing ? null : () => _goTo(_page - 1),
                        icon: const Icon(
                          Icons.arrow_back_rounded,
                          color: EcoColors.green,
                        ),
                      ),
                    if (_page != 0) const Spacer(),
                    TextButton(
                      onPressed: _finishing ? null : () => _finish(false),
                      child: const Text('Skip'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _controller,
                  physics: _finishing
                      ? const NeverScrollableScrollPhysics()
                      : null,
                  itemCount: _pages.length,
                  onPageChanged: (value) => setState(() => _page = value),
                  itemBuilder: (context, index) {
                    final page = _pages[index];
                    return LayoutBuilder(
                      builder: (context, constraints) {
                        final compact = constraints.maxHeight < 440;
                        final titleStyle = TextStyle(
                          fontSize: compact ? 26 : 32,
                          height: 1.17,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1,
                          color: EcoColors.green,
                        );
                        const labelStyle = TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: EcoColors.body,
                        );
                        final bodyStyle = TextStyle(
                          fontSize: compact ? 13 : 14,
                          height: 1.5,
                          color: EcoColors.body,
                        );
                        double textHeight(String text, TextStyle style) {
                          final painter = TextPainter(
                            text: TextSpan(
                              text: text,
                              style: DefaultTextStyle.of(
                                context,
                              ).style.merge(style),
                            ),
                            textDirection: Directionality.of(context),
                            textScaler: MediaQuery.textScalerOf(context),
                          )..layout(maxWidth: constraints.maxWidth - 48);
                          final height = painter.height;
                          painter.dispose();
                          return height;
                        }

                        final imageGap = compact ? 12.0 : 24.0;
                        final titleGap = compact ? 8.0 : 12.0;
                        final bodyGap = compact ? 10.0 : 16.0;
                        final copyHeight =
                            textHeight(page.label, labelStyle) +
                            textHeight(page.title, titleStyle) +
                            textHeight(page.body, bodyStyle);
                        // Keep all copy above the fixed actions. Extra-large text
                        // can still scroll without shrinking the user's font size.
                        final imageSize =
                            (constraints.maxHeight -
                                    copyHeight -
                                    imageGap -
                                    titleGap -
                                    bodyGap -
                                    24)
                                .clamp(
                                  72.0,
                                  (constraints.maxWidth - 48).clamp(
                                    72.0,
                                    280.0,
                                  ),
                                );
                        return SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(24, 12, 24, 12),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight - 24,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Center(
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(32),
                                    child: Image.asset(
                                      page.image,
                                      width: imageSize,
                                      height: imageSize,
                                      fit: BoxFit.contain,
                                      excludeFromSemantics: true,
                                    ),
                                  ),
                                ),
                                SizedBox(height: imageGap),
                                Text(page.label, style: labelStyle),
                                SizedBox(height: titleGap),
                                Semantics(
                                  header: true,
                                  child: Text(page.title, style: titleStyle),
                                ),
                                SizedBox(height: bodyGap),
                                Text(page.body, style: bodyStyle),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      liveRegion: true,
                      label: 'Introduction ${_page + 1} of ${_pages.length}',
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _pages.length; i++)
                            Semantics(
                              button: true,
                              selected: i == _page,
                              label: 'Introduction ${i + 1}',
                              child: InkResponse(
                                onTap: _finishing ? null : () => _goTo(i),
                                radius: 24,
                                child: SizedBox(
                                  width: 44,
                                  height: 44,
                                  child: Center(
                                    child: Container(
                                      width: i == _page ? 22 : 7,
                                      height: 7,
                                      decoration: BoxDecoration(
                                        color: i == _page
                                            ? EcoColors.green
                                            : EcoColors.celadon,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            style: const TextStyle(
                              fontSize: 13,
                              color: EcoColors.danger,
                            ),
                          ),
                        ),
                      ),
                    EcoPrimaryButton(
                      label: lastPage
                          ? 'Create account'
                          : _page == 0
                          ? 'Get started'
                          : 'Continue',
                      icon: Icons.arrow_forward_rounded,
                      loading: _finishing,
                      onPressed: () =>
                          lastPage ? _finish(true) : _goTo(_page + 1),
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _finishing ? null : () => _finish(false),
                      child: Text(
                        'Already a member? Log in',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
