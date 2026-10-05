import { Types } from 'mongoose';
import { setTestDefaultProject } from '../utils/project-context';

// Tests written before projects run inside one default project. Isolation tests call setTestDefaultProject(null).
setTestDefaultProject(new Types.ObjectId());
