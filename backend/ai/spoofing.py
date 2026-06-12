"""
ai/spoofing.py — Anti-spoofing MiniFASNetV2 (torch, pas d'ONNX)
SmartCampus IA - ESISA Fes 2025

Détecte les visages "faux" (photo brandie, masque, écran).
Le modèle requis est un checkpoint pruné (canaux irréguliers) — l'architecture
est reconstruite dynamiquement à partir des shapes du fichier .pth.

Modèle requis (téléchargé par convert_antispoof.py) :
  ai/models/anti_spoof/2.7_80x80_MiniFASNetV2.pth

Si le fichier est absent → mode passthrough (tous les visages acceptés).
"""

import os
import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)

_PTH_PATH = os.path.join(
    os.path.dirname(__file__), "models", "anti_spoof",
    "2.7_80x80_MiniFASNetV2.pth",
)


# ── Architecture MiniFASNetV2 reconstruite depuis le checkpoint ───────────────

def _build_from_state(state: dict, num_classes: int = 3,
                      conv6_kernel: tuple = (5, 5)):
    """
    Construit MiniFASNetV2 en inférant les dimensions de canaux directement
    depuis les shapes du state_dict (modèle pruné → canaux irréguliers).
    """
    import torch.nn as nn

    # ── Blocs de base ─────────────────────────────────────────────────────────

    class Conv_block(nn.Module):
        def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1),
                     padding=(0, 0), groups=1):
            super().__init__()
            self.conv  = nn.Conv2d(in_c, out_c, kernel_size=kernel,
                                   groups=groups, stride=stride,
                                   padding=padding, bias=False)
            self.bn    = nn.BatchNorm2d(out_c)
            self.prelu = nn.PReLU(out_c)

        def forward(self, x):
            return self.prelu(self.bn(self.conv(x)))

    class Linear_block(nn.Module):
        def __init__(self, in_c, out_c, kernel=(1, 1), stride=(1, 1),
                     padding=(0, 0), groups=1):
            super().__init__()
            self.conv = nn.Conv2d(in_c, out_c, kernel_size=kernel,
                                  groups=groups, stride=stride,
                                  padding=padding, bias=False)
            self.bn   = nn.BatchNorm2d(out_c)

        def forward(self, x):
            return self.bn(self.conv(x))

    class Depth_Wise(nn.Module):
        def __init__(self, in_c, out_c, residual=False, kernel=(3, 3),
                     stride=(2, 2), padding=(1, 1), groups=1):
            super().__init__()
            self.conv     = Conv_block(in_c, groups,
                                       kernel=(1, 1), stride=(1, 1), padding=(0, 0))
            self.conv_dw  = Conv_block(groups, groups, groups=groups,
                                       kernel=kernel, stride=stride, padding=padding)
            self.project  = Linear_block(groups, out_c,
                                         kernel=(1, 1), stride=(1, 1), padding=(0, 0))
            self.residual = residual

        def forward(self, x):
            short = x
            x = self.conv(x)
            x = self.conv_dw(x)
            x = self.project(x)
            return short + x if self.residual else x

    # Wrapper qui reproduit la clé "conv_X.model.N.*" du checkpoint original
    class VarResidual(nn.Module):
        def __init__(self, c, groups_list, kernel=(3, 3),
                     stride=(1, 1), padding=(1, 1)):
            super().__init__()
            self.model = nn.Sequential(*[
                Depth_Wise(c, c, residual=True,
                           kernel=kernel, stride=stride, padding=padding, groups=g)
                for g in groups_list
            ])

        def forward(self, x):
            return self.model(x)

    class Flatten(nn.Module):
        def forward(self, x):
            return x.view(x.size(0), -1)

    # ── Inférence des dimensions depuis le checkpoint ─────────────────────────

    def _g(key):
        return state[key].shape[0]

    def _block_groups(prefix):
        """Retourne la liste des intermediate-channels pour chaque bloc."""
        idx = 0
        groups = []
        while f"{prefix}.model.{idx}.conv.conv.weight" in state:
            groups.append(_g(f"{prefix}.model.{idx}.conv.conv.weight"))
            idx += 1
        return groups

    c1    = _g("conv1.conv.weight")
    c23g  = _g("conv_23.conv.conv.weight")
    c23o  = _g("conv_23.project.conv.weight")
    g3    = _block_groups("conv_3")
    c34g  = _g("conv_34.conv.conv.weight")
    c34o  = _g("conv_34.project.conv.weight")
    g4    = _block_groups("conv_4")
    c45g  = _g("conv_45.conv.conv.weight")
    c45o  = _g("conv_45.project.conv.weight")
    g5    = _block_groups("conv_5")
    c6s   = _g("conv_6_sep.conv.weight")
    emb   = state["linear.weight"].shape[0]

    # ── Modèle ────────────────────────────────────────────────────────────────

    class MiniFASNetV2(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv1          = Conv_block(3, c1,
                                             kernel=(3, 3), stride=(2, 2), padding=(1, 1))
            self.conv2_dw       = Conv_block(c1, c1, groups=c1,
                                             kernel=(3, 3), stride=(1, 1), padding=(1, 1))
            self.conv_23        = Depth_Wise(c1, c23o,
                                             kernel=(3, 3), stride=(2, 2), padding=(1, 1),
                                             groups=c23g)
            self.conv_3         = VarResidual(c23o, g3,
                                              kernel=(3, 3), stride=(1, 1), padding=(1, 1))
            self.conv_34        = Depth_Wise(c23o, c34o,
                                             kernel=(3, 3), stride=(2, 2), padding=(1, 1),
                                             groups=c34g)
            self.conv_4         = VarResidual(c34o, g4,
                                              kernel=(3, 3), stride=(1, 1), padding=(1, 1))
            self.conv_45        = Depth_Wise(c34o, c45o,
                                             kernel=(3, 3), stride=(2, 2), padding=(1, 1),
                                             groups=c45g)
            self.conv_5         = VarResidual(c45o, g5,
                                              kernel=(3, 3), stride=(1, 1), padding=(1, 1))
            self.conv_6_sep     = Conv_block(c45o, c6s,
                                             kernel=(1, 1), stride=(1, 1), padding=(0, 0))
            self.conv_6_dw      = Linear_block(c6s, c6s, groups=c6s,
                                               kernel=conv6_kernel,
                                               stride=(1, 1), padding=(0, 0))
            self.conv_6_flatten = Flatten()
            self.linear         = nn.Linear(c6s, emb)
            self.bn             = nn.BatchNorm1d(emb)
            self.drop           = nn.Dropout(p=0.75)
            self.prob           = nn.Linear(emb, num_classes)

        def forward(self, x):
            x = self.conv1(x)
            x = self.conv2_dw(x)
            x = self.conv_23(x)
            x = self.conv_3(x)
            x = self.conv_34(x)
            x = self.conv_4(x)
            x = self.conv_45(x)
            x = self.conv_5(x)
            x = self.conv_6_sep(x)
            x = self.conv_6_dw(x)
            x = self.conv_6_flatten(x)
            x = self.linear(x)
            x = self.bn(x)
            x = self.drop(x)
            return self.prob(x)

    return MiniFASNetV2()


# ── Classe principale ─────────────────────────────────────────────────────────

class AntiSpoofing:
    """
    Wrapper MiniFASNetV2 (torch).
    Si le modèle n'est pas disponible, is_real() retourne toujours (True, 1.0).
    """

    def __init__(self):
        self._model     = None
        self._available = False
        self._load()

    def _load(self):
        if not os.path.exists(_PTH_PATH):
            logger.warning(
                "Modèle anti-spoofing non trouvé : %s — passthrough activé.",
                _PTH_PATH,
            )
            return
        try:
            import torch

            state = torch.load(_PTH_PATH, map_location="cpu", weights_only=False)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            state = {k.replace("module.", ""): v for k, v in state.items()}

            model = _build_from_state(state, num_classes=3)
            missing, unexpected = model.load_state_dict(state, strict=False)
            if unexpected:
                logger.debug("Clés inattendues (ignorées) : %s", unexpected[:5])
            model.eval()

            self._model     = model
            self._torch     = torch
            self._available = True
            logger.info("Anti-spoofing MiniFASNetV2 chargé depuis %s.", _PTH_PATH)
        except Exception as exc:
            logger.warning("Chargement anti-spoofing échoué : %s — passthrough.", exc)

    def is_real(self, face_bgr: np.ndarray) -> tuple[bool, float]:
        """
        Prédit si le visage est réel (True) ou falsifié (False).
        Returns (is_real: bool, confiance: float 0-1).
        Passthrough (True, 1.0) si le modèle est absent ou si une erreur survient.
        """
        if not self._available or self._model is None:
            return True, 1.0

        try:
            face80 = cv2.resize(face_bgr, (80, 80))
            tensor = self._torch.from_numpy(face80).permute(2, 0, 1).float() / 255.0
            tensor = tensor.unsqueeze(0)

            with self._torch.inference_mode():
                logits = self._model(tensor)
                prob = self._torch.softmax(logits, dim=1)[0]

            is_real = int(prob.argmax()) == 1
            conf = float(prob[1])
            logger.debug(
                "SPOOF is_real=%s prob_real=%.4f prob_fake0=%.4f prob_fake2=%.4f",
                is_real, conf, float(prob[0]), float(prob[2]),
            )
            return is_real, conf
        except Exception as exc:
            logger.debug("Anti-spoofing erreur frame : %s", exc)
            return True, 1.0


# ── Singleton ─────────────────────────────────────────────────────────────────

_anti_spoofing: AntiSpoofing | None = None


def get_anti_spoofing() -> AntiSpoofing:
    global _anti_spoofing
    if _anti_spoofing is None:
        _anti_spoofing = AntiSpoofing()
    return _anti_spoofing
