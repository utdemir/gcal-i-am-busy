let
pkgs = import (import ./nix/sources.nix).nixpkgs {};
in
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs_latest
  ];
}
