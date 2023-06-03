FROM openjdk:11-jre-slim

# 创建一个新目录来存储jdk文件
WORKDIR /home/infinova/device-management
ENV TZ Asia/Shanghai
ADD README.md /home/infinova/
RUN rm -f /etc/localtime \
&& ln -sv /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
&& echo "Asia/Shanghai" > /etc/timezone
ENTRYPOINT ["cd",  "/home/infinova/"]
