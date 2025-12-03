from . import databases
from . import backup
from . import backup_list
from . import restore_drive
from . import rpc
from . import gdrive_image
from . import upload_to_drive
from . import routes

def init_routes(app):
    # Routes globales (login, verify, health, root, databases)
    routes.register_routes(app)
    databases.register_routes(app)
    
    # Routes RPC
    rpc.register_routes(app)

    # Routes Backup
    backup.register_routes(app)
    backup_list.register_routes(app)
    restore_drive.register_routes(app)

    # Routes Google Drive images
    gdrive_image.register_routes(app)
    upload_to_drive.register_routes(app)
