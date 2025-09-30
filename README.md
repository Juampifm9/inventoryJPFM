# InventoryJPFM — Guía de despliegue (AWS) #

Aplicación **Node.js + Express** (sirve `/public/index.html` y API) con **MySQL**.

> Los valores de la base de datos y del puerto quedan **fijos** en la app a través del archivo `.env`.  
> Si un usuario desea otros valores, puede **editarlos manualmente** en el `.env` de la instancia después del despliegue.

```
PORT=80
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=invuser
DB_PASS=invpass
DB_NAME=inventory
```

---

## Índice

1. [EC2 (Consola) — Manual + SSH](#1-ec2-consola--manual--ssh)
2. [EC2 (Consola) — Con User Data](#2-ec2-consola--con-user-data)
3. [EC2 (CLI en Windows CMD)](#3-ec2-cli-en-windows-cmd)
4. [Elastic Beanstalk (solo consola)](#4-elastic-beanstalk-solo-consola)
5. [Variables que un usuario podría cambiar](#5-variables-que-un-usuario-podría-cambiar)
6. [Dónde ejecutar cada cosa](#6-dónde-ejecutar-cada-cosa)
7. [Troubleshooting rápido](#7-troubleshooting-rápido)
8. [Archivos de soporte (no modificar)](#8-archivos-de-soporte-no-modificar)

---

## 1) EC2 (Consola) — Manual + SSH

### 1.1 Crear la instancia (Consola AWS → EC2 → *Launch instance*)
- **Name and tags**: `inventory-manual`
- **Application and OS Images (AMI)**: `Ubuntu Server 22.04 LTS (x86_64)`
- **Instance type**: `t3.micro` (o superior)
- **Key pair**: crear/seleccionar (descargar `.pem`)
- **Network settings**
  - **VPC**: default (o la tuya)
  - **Subnet**: pública
  - **Auto-assign Public IP**: **Enabled**
  - **Firewall (security groups)** → **Create security group**  
    - Inbound **SSH** TCP **22** → *My IP*  
    - Inbound **HTTP** TCP **80** → *Anywhere (0.0.0.0/0)*
- **Configure storage**: 20 GiB `gp3`
- **Launch instance**

### 1.2 Conectarte por SSH (desde tu PC)
```bash
chmod 400 <tu-key>.pem
ssh -i <tu-key>.pem ubuntu@<DNS-o-IP-pública>
```

### 1.3 Instalar recursos, clonar y ejecutar (en la instancia)
```bash
# Sistema y herramientas
sudo apt update -y && sudo apt install -y git npm mysql-server libcap2-bin
sudo systemctl enable --now mysql

# Código
cd ~
git clone https://github.com/Juampifm9/inventoryJPFM.git
cd inventoryJPFM
(npm ci || npm install)

# .env (valores fijos de la app)
cat > .env <<'EOF'
PORT=80
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=invuser
DB_PASS=invpass
DB_NAME=inventory
EOF

# Crear DB/usuario leyendo del .env (no modificar estas líneas)
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS $(. ./.env; printf %s "$DB_NAME") CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$(. ./.env; printf %s "$DB_USER")'@'localhost' IDENTIFIED BY '$(. ./.env; printf %s "$DB_PASS")';
CREATE USER IF NOT EXISTS '$(. ./.env; printf %s "$DB_USER")'@'127.0.0.1' IDENTIFIED BY '$(. ./.env; printf %s "$DB_PASS")';
GRANT ALL PRIVILEGES ON $(. ./.env; printf %s "$DB_NAME").* TO '$(. ./.env; printf %s "$DB_USER")'@'localhost';
GRANT ALL PRIVILEGES ON $(. ./.env; printf %s "$DB_NAME").* TO '$(. ./.env; printf %s "$DB_USER")'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# Permitir a Node escuchar en 80 y arrancar
sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")"
npm start
```

---

## 2) EC2 (Consola) — Con User Data

> Usar **tal cual** uno de estos archivos **(no modificarlos)**:
>
> - `userdataCLI.sh`
> - `user-data-test-ec2.txt`
>
> Ambos instalan git/npm/mysql, clonan el repo, escriben `.env` (valores fijos), crean DB/usuario y ejecutan `npm start &`.

### 2.1 Crear la instancia con User Data (Consola AWS → EC2 → *Launch instance*)
- **Name**: `inventory-userdata`
- **AMI**: `Ubuntu Server 22.04 LTS (x86_64)`
- **Instance type**: `t3.micro`
- **Key pair**: tu `.pem`
- **Network settings**
  - VPC y **Subnet pública**
  - **Auto-assign Public IP**: **Enabled**
  - **Security group**: abrir **22** (tu IP) y **80** (0.0.0.0/0)
- **Advanced details → User data**: pegar el contenido **tal cual** del archivo elegido
- **Launch instance**

> La instancia ejecuta el User Data al iniciar y deja la app corriendo.

---

## 3) EC2 (CLI en Windows CMD)

> Usar **tal cual** el archivo: `Comms para CLI AWS.txt`.  
> Reemplazar **solo** lo que se indica (ruta local del `--user-data`, y si corresponde, el **SubnetId**).

### 3.1 Ejecutar en `cmd.exe` (Windows)

1) **Región**
```bat
aws configure set region us-east-1
```

2) **Crear Security Group y capturar su GroupId**
```bat
FOR /F "usebackq delims=" %G IN (`aws ec2 create-security-group --group-name "sg-inventory-CLI-1" --description "sg-inventory-CLI-1_desc" --vpc-id "vpc-XXXXXXXX" --query GroupId --output text`) DO SET SG_ID=%G
```

3) **Reglas de entrada (22 y 80)**
```bat
aws ec2 authorize-security-group-ingress --group-id "%SG_ID%" --protocol tcp --port 22 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "%SG_ID%" --protocol tcp --port 80 --cidr 0.0.0.0/0
```

4) **Lanzar instancia** (con **User Data** desde tu PC)
```bat
aws ec2 run-instances ^
  --image-id "ami-0360c520857e3138f" ^
  --instance-type "t3.micro" ^
  --key-name "appjpfmuade1" ^
  --security-group-ids "%SG_ID%" ^
  --associate-public-ip-address ^
  --block-device-mappings DeviceName=/dev/sda1,Ebs={Encrypted=false,DeleteOnTermination=true,VolumeSize=20,VolumeType=gp3,Iops=3000,Throughput=125} ^
  --credit-specification CpuCredits=unlimited ^
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=inventory-CLI-1}]" ^
  --metadata-options "HttpEndpoint=enabled,HttpPutResponseHopLimit=2,HttpTokens=required" ^
  --private-dns-name-options "HostnameType=ip-name,EnableResourceNameDnsARecord=true,EnableResourceNameDnsAAAARecord=false" ^
  --user-data file://C:\Ruta\Completa\userdataCLI.sh ^
  --count "1"
```
> **Opcional (recomendado):** agrega `--subnet-id "subnet-XXXXX"` si el SG está en una VPC específica.

---

## 4) Elastic Beanstalk (solo consola)

> Requisitos: tener una **DB MySQL** accesible (ideal **RDS MySQL**). En EB no se usa `.env`; las credenciales se cargan como **Environment properties**.

### 4.1 Subir la app
1. En tu PC: comprimir **el contenido** del proyecto en un ZIP (sin `node_modules`).
2. En la consola: **Elastic Beanstalk → Create application**
   - **Application name**: `inventory-eb`
   - **Platform**: **Node.js**
   - **Application code**: **Upload your code** → subir el ZIP
   - **Create application**

### 4.2 Variables de entorno (DB)
- En el **Environment** → **Configuration** → **Software** → **Edit** → **Environment properties**:
  - `DB_HOST` = endpoint de tu RDS u otra MySQL
  - `DB_PORT` = `3306`
  - `DB_USER` = `invuser`
  - `DB_PASS` = `invpass`
  - `DB_NAME` = `inventory`
- **Save** (EB reinicia la app)

### 4.3 Regla de seguridad entre EB y RDS (si usás RDS privado)
- **EC2 → Instances** → abrir la instancia del environment EB → anotar su **Security Group**.
- **RDS → tu instancia** → **Security group** → **Edit inbound rules**:
  - **Type**: MySQL/Aurora (3306)
  - **Source**: **Security Group del environment de EB**
- **Save**  
- **EB → Open** (la URL pública del environment).

> EB define su `PORT` internamente. Como la app usa `process.env.PORT`, no hay que cambiar el código.

---

## 5) Variables que un usuario podría cambiar
- **EC2 manual / User Data (MySQL local):** los valores quedan **fijos** en el `.env` generado en la instancia (`PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`).  
  Si se quieren otros, **editar manualmente** el `.env` y reiniciar la app.
- **Elastic Beanstalk:** cambiar credenciales en **Configuration → Software → Environment properties** (`DB_*`).

---

## 6) Dónde ejecutar cada cosa
- **Consola EC2/EB (UI web):** creación de instancias, selección de AMI, tipo, SG, User Data (en EC2) y carga de ZIP/variables (en EB).
- **SSH dentro de la instancia (EC2 Manual):** instalación de paquetes, clon del repo, creación del `.env`, comandos MySQL y `npm start`.
- **Windows CMD (CLI):** `aws configure`, creación de SG, reglas, `run-instances` con `--user-data` (usando `Comms para CLI AWS.txt`).
- **RDS (consola):** creación de base MySQL y edición de reglas de SG (si aplica).

---

## 7) Troubleshooting rápido
- **No responde por HTTP:** abrir **puerto 80** en el Security Group y confirmar IP pública.
- **`ECONNREFUSED 127.0.0.1:3306`**: MySQL no levantó o `DB_HOST/PORT` incorrectos.
- **`ER_ACCESS_DENIED_ERROR`**: usuario/clave/DB no coinciden; recrear usuario o corregir `.env` / env vars de EB.
- **EB no conecta a RDS**: falta la **regla 3306** desde el SG de EB hacia el SG de RDS.

---

## 8) Archivos de soporte (no modificar)
- `Comms para CLI AWS.txt` — comandos listos para **Windows CMD** (crear SG, abrir puertos, `run-instances` con user-data).
- `userdataCLI.sh` — *User Data* para EC2: instala recursos, clona, crea `.env`, configura MySQL y ejecuta la app.
- `user-data-test-ec2.txt` — variante alternativa de *User Data* con el mismo objetivo.
- `Abrir EC2 en AWS_1.txt` — referencia de pasos manuales en consola (EC2 + SSH + instalar + clonar + `npm start`).

> **Importante:** estos archivos deben usarse **tal cual**, sin modificaciones.  
> Solo se reemplazan **valores** al momento de ejecutar (por ejemplo, la **ruta** del `--user-data` en CLI, o las **Environment properties** en EB).
