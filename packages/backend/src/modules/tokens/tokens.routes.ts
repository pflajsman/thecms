import { Router, type IRouter, type Request } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validation.middleware';
import { TokensService } from './tokens.service';

const router: IRouter = Router();

const createTokenBody = z.object({
  name: z.string().trim().min(1).max(100),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).optional(),
});
const createTokenSchema = z.object({ body: createTokenBody });

const userId = (req: Request) => (req as AuthRequest).user!.entraId;

// Admin login only: a personal access token is not a JWT, so authMiddleware refuses it.
router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    res.json({ success: true, data: await TokensService.list(userId(req)) });
  } catch (error) {
    next(error);
  }
});

router.post('/', validate(createTokenSchema), async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await TokensService.create(userId(req), createTokenBody.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await TokensService.revoke(userId(req), req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
