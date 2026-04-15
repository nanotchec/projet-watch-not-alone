import { useEffect, useRef, useState } from 'react';
import type { AnnotationPayload } from '../hooks/useSocket';

export type AnnotationTool = 'draw' | 'text';

interface Props {
  annotations: AnnotationPayload[];
  isDrawingEnabled: boolean;
  activeTool: AnnotationTool;
  color: string;
  pendingText: string;
  onAddAnnotation: (payload: any, type: 'DESSIN' | 'TEXTE') => void;
}

export default function AnnotationOverlay({
  annotations,
  isDrawingEnabled,
  activeTool,
  color,
  pendingText,
  onAddAnnotation,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  //dessine tout les elements
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    //fait en sorte que la taille de l'element du canvas soit synchro avec la taille de la fenetre de l'element
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    //dessine les traits en fessant des calculs de position relative au curseur
    const drawPath = (points: { x: number; y: number }[], strokeColor: string) => {
      if (!points || points.length < 2) return;
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = strokeColor;
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * canvas.width, points[i].y * canvas.height);
      }
      ctx.stroke();
    };

    //meme chose mais pour les textes qui les ajoutes a la position du curseur
    const drawText = (text: string, x: number, y: number, textColor: string) => {
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.fillStyle = textColor;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(text, x * canvas.width, y * canvas.height);
      ctx.shadowBlur = 0;
    };

    //dessine les annotations confirmer (des annotations qui ont deja ete envoyer au serveur)
    annotations.forEach((ann) => {
      const c = ann.payload?.color ?? '#ef4444';
      if (ann.type === 'DESSIN' && ann.payload?.points) {
        drawPath(ann.payload.points, c);
      } else if (ann.type === 'TEXTE' && ann.payload?.text) {
        drawText(ann.payload.text, ann.payload.x, ann.payload.y, c);
      }
    });

    if (currentPath.length > 0) {
      drawPath(currentPath, color);
    }
  };

  //redessine tout les elements quand il y a un changement
  useEffect(() => {
    redraw();
    window.addEventListener('resize', redraw);
    return () => window.removeEventListener('resize', redraw);
  }, [annotations, currentPath, color]);

  //recupere la position relative du curseur
  const getRelativePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  };

  //quand l'utilisateur clique sur le canvas, il ajoute un point ou un texte
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingEnabled) return;
    if (activeTool === 'text') {
      const { x, y } = getRelativePos(e);
      const text = pendingText.trim();
      if (!text) return;
      onAddAnnotation({ text, x, y, color }, 'TEXTE');
      return;
    }
    setIsDrawing(true);
    setCurrentPath([getRelativePos(e)]);
  };

  //quand l'utilisateur bouge le curseur, il ajoute un point sur le trait
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !isDrawingEnabled || activeTool !== 'draw') return;
    setCurrentPath((prev) => [...prev, getRelativePos(e)]);
  };

  //quand l'utilisateur relache le clic, il ajoute le trait ou le texte
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 1) {
      onAddAnnotation({ points: currentPath, color }, 'DESSIN');
    }
    setCurrentPath([]);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`absolute inset-0 z-40 w-full h-full ${isDrawingEnabled ? (activeTool === 'text' ? 'cursor-text' : 'cursor-crosshair') : 'pointer-events-none'
        }`}
    />
  );
}
