import 'package:flutter/material.dart';

import '../widgets/eco_loading.dart';

/// Draw the brand screen while configuration and services initialize.
class EcoStartup extends StatefulWidget {
  const EcoStartup({super.key, required this.initialize, required this.child});

  final Future<void> Function() initialize;
  final Widget child;

  @override
  State<EcoStartup> createState() => _EcoStartupState();
}

class _EcoStartupState extends State<EcoStartup> {
  late Future<void> _initialization;

  @override
  void initState() {
    super.initState();
    _initialization = Future<void>.sync(widget.initialize);
  }

  void _retry() {
    final initialization = Future<void>.sync(widget.initialize);
    setState(() {
      _initialization = initialization;
    });
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<void>(
    future: _initialization,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const EcoLoadingScreen();
      }
      if (snapshot.hasError) return EcoLoadingScreen(onRetry: _retry);
      return widget.child;
    },
  );
}
