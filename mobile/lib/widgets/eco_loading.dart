import 'package:flutter/material.dart';

import '../theme/eco_theme.dart';
import 'eco_components.dart';

/// A real, indeterminate loading state. No artificial delay or progress count.
class EcoLoadingState extends StatelessWidget {
  const EcoLoadingState({
    super.key,
    this.title = 'Getting things ready',
    this.message = 'Your next small step to a greener tomorrow.',
    this.compact = false,
  });

  final String title;
  final String message;
  final bool compact;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Semantics(
        liveRegion: true,
        label: '$title. $message',
        child: ExcludeSemantics(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!compact) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(24),
                  child: Image.asset(
                    'assets/images/generated/recycling-garden.webp',
                    width: 240,
                    height: 240,
                  ),
                ),
                const SizedBox(height: 24),
              ],
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: EcoColors.green,
                  backgroundColor: EcoColors.celadon,
                  // Keep a clear static indicator when the OS requests reduced motion.
                  value: MediaQuery.disableAnimationsOf(context) ? .75 : null,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: EcoColors.green,
                  letterSpacing: -.6,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.6,
                  color: EcoColors.body,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class EcoLoadingScreen extends StatelessWidget {
  const EcoLoadingScreen({super.key, this.onRetry});

  /// A startup failure retains the brand screen and offers a real retry.
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: EcoColors.ivory,
    body: SafeArea(
      child: Column(
        children: [
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ExcludeSemantics(
                      child: Container(
                        width: 160,
                        height: 160,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: EcoColors.honeydew,
                          borderRadius: BorderRadius.circular(52),
                          border: Border.all(
                            color: EcoColors.celadon.withValues(alpha: .55),
                          ),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: EcoColors.celadon.withValues(alpha: .35),
                            borderRadius: BorderRadius.circular(40),
                          ),
                          child: const EcoLogo(size: 104, cornerRadius: 30),
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),
                    Semantics(
                      header: true,
                      child: const Text(
                        'EcoCycle',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 34,
                          height: 1.15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -1.2,
                          color: EcoColors.green,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Small steps. Lasting change.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: EcoColors.body,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 40),
            child: onRetry != null
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Semantics(
                        liveRegion: true,
                        child: const Text(
                          'Could not open EcoCycle. Please try again.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: EcoColors.body,
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      EcoPrimaryButton(label: 'Try again', onPressed: onRetry),
                    ],
                  )
                : Semantics(
                    liveRegion: true,
                    label: 'Getting EcoCycle ready',
                    child: ExcludeSemantics(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: EcoColors.green,
                              backgroundColor: EcoColors.celadon,
                              value: MediaQuery.disableAnimationsOf(context)
                                  ? .75
                                  : null,
                            ),
                          ),
                          const SizedBox(height: 14),
                          const Text(
                            'Getting things ready…',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: EcoColors.body,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    ),
  );
}
